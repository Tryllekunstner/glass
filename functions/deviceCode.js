/**
 * Phase 2: Device Code grant-style authentication flow
 * Functions:
 *  - pickleGlassDeviceCodeStart (onRequest POST)
 *      Issues a device_code + user_code pair and persists a pending record in Firestore
 *  - pickleGlassDeviceCodePoll (onRequest POST)
 *      Desktop polls with device_code; returns authorization_pending | approved(customToken) | expired_token | invalid_code
 *  - pickleGlassDeviceCodeComplete (onRequest POST)
 *      Web completes the flow by providing a valid user ID token + user_code; marks the request approved for polling client
 *
 * Notes:
 *  - Region aligned to europe-west1
 *  - Firestore doc layout:
 *      deviceCodes/{dc_<sha256(device_code)>}:
 *        { deviceCodeHash, userCode, status, createdAt, expiresAt, interval, uid?, usedAt?, approvedAt? }
 *      deviceUserCodes/{<userCode>}:
 *        { deviceCodeRef: 'dc_<hash>', createdAt, expiresAt }
 *  - Production should consider stronger rate limiting, PKCE, and durable queues. This is a minimal reference per plan.
 */

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");

const REGION = "europe-west1";

// Ensure Admin initialized (index.js typically does this)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function randomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}

function generateUserCode() {
  // 8-char base32-ish, grouped as XXXX-XXXX
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 for readability
  let raw = "";
  for (let i = 0; i < 8; i++) {
    raw += alpha[Math.floor(Math.random() * alpha.length)];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function getVerificationUri() {
  // Allow override via env, default to a placeholder path on the web app
  return process.env.DEVICE_VERIFICATION_URI || "https://glass.pickleglass.app/device";
}

function clampPositiveInt(v, def) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.floor(n);
}

async function putDeviceCode(docId, data) {
  await db.collection("deviceCodes").doc(docId).set(data, { merge: true });
}

async function getDeviceCode(docId) {
  const snap = await db.collection("deviceCodes").doc(docId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function putUserCodeMap(userCode, docId, expiresAt) {
  await db.collection("deviceUserCodes").doc(userCode).set(
    {
      deviceCodeRef: docId,
      createdAt: Date.now(),
      expiresAt,
    },
    { merge: true }
  );
}

async function getUserCodeMap(userCode) {
  const snap = await db.collection("deviceUserCodes").doc(userCode).get();
  return snap.exists ? snap.data() : null;
}

exports.pickleGlassDeviceCodeStart = onRequest({ region: REGION }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }

    // Optional client-specified polling interval (seconds) with sane clamp
    const requestedInterval = req.body?.interval;
    const interval = clampPositiveInt(requestedInterval, 5); // default 5s

    const deviceCode = randomHex(32); // 64 hex chars
    const deviceCodeHash = sha256Hex(deviceCode);
    const userCode = generateUserCode();
    const docId = `dc_${deviceCodeHash}`;

    const now = Date.now();
    const expiresInSec = 600; // 10 minutes
    const expiresAt = now + expiresInSec * 1000;

    const verificationUri = getVerificationUri();
    const verificationUriComplete = `${verificationUri}?code=${encodeURIComponent(userCode)}`;

    const payload = {
      deviceCodeHash,
      userCode,
      status: "pending", // pending | approved | used | expired
      createdAt: now,
      expiresAt,
      interval,
    };

    await putDeviceCode(docId, payload);
    await putUserCodeMap(userCode, docId, expiresAt);

    logger.info("device_code_start", {
      id: docId,
      expiresInSec,
      interval,
    });

    res.status(200).json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri,
      verification_uri_complete: verificationUriComplete,
      expires_in: expiresInSec,
      interval,
    });
  } catch (e) {
    logger.error("device_code_start_error", { error: e.message, stack: e.stack });
    res.status(500).json({ error: "server_error" });
  }
});

exports.pickleGlassDeviceCodePoll = onRequest({ region: REGION }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    const deviceCode = req.body?.device_code;
    if (!deviceCode || typeof deviceCode !== "string") {
      res.status(400).json({ error: "invalid_request", message: "device_code required" });
      return;
    }

    const docId = `dc_${sha256Hex(deviceCode)}`;
    const rec = await getDeviceCode(docId);
    if (!rec) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }

    const now = Date.now();
    if (now >= rec.expiresAt) {
      if (rec.status !== "expired" && rec.status !== "used") {
        await putDeviceCode(docId, { status: "expired" });
      }
      res.status(200).json({ status: "expired_token" });
      return;
    }

    if (rec.status === "pending") {
      // Authorization not completed yet
      res.status(200).json({
        status: "authorization_pending",
        interval: rec.interval || 5,
      });
      return;
    }

    if (rec.status === "approved") {
      if (!rec.uid) {
        // Defensive: should not happen
        res.status(500).json({ error: "server_error" });
        return;
      }

      // Create a Firebase custom token for the approved UID
      try {
        const customToken = await admin.auth().createCustomToken(rec.uid);
        // Mark as used to prevent reuse
        await putDeviceCode(docId, { status: "used", usedAt: now });

        res.status(200).json({
          status: "approved",
          customToken,
        });
        return;
      } catch (e) {
        logger.error("device_code_poll_token_error", { error: e.message });
        res.status(500).json({ error: "server_error" });
        return;
      }
    }

    if (rec.status === "used") {
      res.status(200).json({ status: "already_used" });
      return;
    }

    if (rec.status === "expired") {
      res.status(200).json({ status: "expired_token" });
      return;
    }

    // Fallback
    res.status(200).json({ status: "authorization_pending" });
  } catch (e) {
    logger.error("device_code_poll_error", { error: e.message, stack: e.stack });
    res.status(500).json({ error: "server_error" });
  }
});

exports.pickleGlassDeviceCodeComplete = onRequest({ region: REGION }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }

    const userCode = req.body?.user_code;
    const idToken = req.body?.token; // Firebase ID token for the logged-in web user

    if (!userCode || typeof userCode !== "string" || !idToken || typeof idToken !== "string") {
      res.status(400).json({ error: "invalid_request" });
      return;
    }

    // Verify web user's ID token
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }

    const map = await getUserCodeMap(userCode);
    if (!map || !map.deviceCodeRef) {
      res.status(400).json({ error: "invalid_user_code" });
      return;
    }

    const rec = await getDeviceCode(map.deviceCodeRef);
    if (!rec) {
      res.status(400).json({ error: "invalid_user_code" });
      return;
    }

    const now = Date.now();
    if (now >= rec.expiresAt) {
      await putDeviceCode(map.deviceCodeRef, { status: "expired" });
      res.status(200).json({ status: "expired_token" });
      return;
    }

    if (rec.status === "approved" || rec.status === "used") {
      res.status(200).json({ status: rec.status });
      return;
    }

    // Approve the device_code for this uid
    await putDeviceCode(map.deviceCodeRef, {
      status: "approved",
      approvedAt: now,
      uid: decoded.uid,
    });

    logger.info("device_code_completed", {
      userCode,
      ref: map.deviceCodeRef,
      uid: decoded.uid,
    });

    res.status(200).json({ status: "approved" });
  } catch (e) {
    logger.error("device_code_complete_error", { error: e.message, stack: e.stack });
    res.status(500).json({ error: "server_error" });
  }
});
