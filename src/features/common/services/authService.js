const { onAuthStateChanged, signInWithCustomToken, signOut } = require('firebase/auth');
const { app, BrowserWindow, shell } = require('electron');
const { getFirebaseAuth, getFirestoreInstance } = require('./firebaseClient');
const fetch = require('node-fetch');
const encryptionService = require('./encryptionService');
const migrationService = require('./migrationService');
const sessionRepository = require('../repositories/session');
const providerSettingsRepository = require('../repositories/providerSettings');
const permissionService = require('./permissionService');
const { doc, setDoc, updateDoc, serverTimestamp, onSnapshot } = require('firebase/firestore');
const Store = require('electron-store');
const crypto = require('crypto');

async function getVirtualKeyByEmail(email, idToken) {
    if (!idToken) {
        throw new Error('Firebase ID token is required for virtual key request');
    }

    const resp = await fetch('https://serverless-api-sf3o.vercel.app/api/virtual_key', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        redirect: 'follow',
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        console.error('[VK] API request failed:', json.message || 'Unknown error');
        throw new Error(json.message || `HTTP ${resp.status}: Virtual key request failed`);
    }

    const vKey = json?.data?.virtualKey || json?.data?.virtual_key || json?.data?.newVKey?.slug;

    if (!vKey) throw new Error('virtual key missing in response');
    return vKey;
}

class AuthService {
    constructor() {
        this.currentUserId = null; // No default user - authentication required
        this.currentUserMode = 'firebase'; // Only firebase mode supported
        this.currentUser = null;
        this.isInitialized = false;
        this.authenticationRequired = true; // Mandatory authentication flag

        // Device/Settings sync (desktop wiring)
        this.settingsUnsub = null;
        this.deviceHeartbeat = null;
        this.deviceId = null;
        this.deviceStore = new Store({ name: 'device-info' });
        this.pendingDeepLinkNonce = null;
        this.pendingDeepLinkNonceExpAt = 0; // epoch ms
        this.lastAuthFlowStartAt = 0;
        this.deviceCodePollAbort = null; // Abort controller for Phase 2 polling

        // This ensures the key is ready before any login/logout state change.
        this.initializationPromise = null;

        sessionRepository.setAuthService(this);
    }

    initialize() {
        if (this.isInitialized) return this.initializationPromise;

        this.initializationPromise = new Promise((resolve) => {
            const auth = getFirebaseAuth();
            onAuthStateChanged(auth, async (user) => {
                const previousUser = this.currentUser;

                if (user) {
                    // User signed IN
                    console.log(`[AuthService] Firebase user signed in:`, user.uid);
                    this.currentUser = user;
                    this.currentUserId = user.uid;
                    this.currentUserMode = 'firebase';

                    // Clean up any zombie sessions from a previous run for this user.
                    await sessionRepository.endAllActiveSessions();

                    // ** Initialize encryption key for the logged-in user if permissions are already granted **
                    if (process.platform === 'darwin' && !(await permissionService.checkKeychainCompleted(this.currentUserId))) {
                        console.warn('[AuthService] Keychain permission not yet completed for this user. Deferring key initialization.');
                    } else {
                        await encryptionService.initializeKey(user.uid);
                    }

                    // ** Check for and run data migration for the user **
                    // No 'await' here, so it runs in the background without blocking startup.
                    migrationService.checkAndRunMigration(user);

                    // Register device and start heartbeat + settings subscription
                    try {
                        await this.registerDevice(user);
                        this.startDeviceHeartbeat();
                        this.startSettingsSubscription(user.uid);
                    } catch (e) {
                        console.warn('[AuthService] Device registration/settings subscription failed:', e?.message || e);
                    }

                    // ***** CRITICAL: Wait for the virtual key and model state update to complete *****
                    try {
                        const idToken = await user.getIdToken(true);
                        const virtualKey = await getVirtualKeyByEmail(user.email, idToken);

                        if (global.modelStateService) {
                            // The model state service now writes directly to the DB, no in-memory state.
                            await global.modelStateService.setFirebaseVirtualKey(virtualKey);
                        }
                        console.log(`[AuthService] Virtual key for ${user.email} has been processed and state updated.`);

                    } catch (error) {
                        console.error('[AuthService] Failed to fetch or save virtual key:', error);
                        // This is not critical enough to halt the login, but we should log it.
                    }

                } else {
                    // User signed OUT - No local mode fallback
                    console.log(`[AuthService] No Firebase user - authentication required.`);
                    if (previousUser) {
                        console.log(`[AuthService] Clearing API key for logged-out user: ${previousUser.uid}`);
                        if (global.modelStateService) {
                            // The model state service now writes directly to the DB.
                            await global.modelStateService.setFirebaseVirtualKey(null);
                        }
                    }
                    this.currentUser = null;
                    this.currentUserId = null; // No fallback user
                    this.currentUserMode = 'firebase'; // Still firebase mode, just not authenticated

                    // End active sessions
                    await sessionRepository.endAllActiveSessions();

                    // Stop device heartbeat and settings subscription
                    this.stopDeviceHeartbeat();
                    this.stopSettingsSubscription();

                    encryptionService.resetSessionKey();
                }
                this.broadcastUserState();
                
                if (!this.isInitialized) {
                    this.isInitialized = true;
                    console.log('[AuthService] Initialized and resolved initialization promise.');
                    resolve();
                }
            });
        });

        return this.initializationPromise;
    }

    async startFirebaseAuthFlow() {
        try {
            const now = Date.now();
            if (now - this.lastAuthFlowStartAt < 3000) {
                console.warn('[AuthService] Auth flow request throttled');
                return { success: false, error: 'throttled' };
            }
            this.lastAuthFlowStartAt = now;

            const dcEnabled = (process.env.DEVICE_CODE_ENABLED === 'true') || (process.env.pickleglass_DEVICE_CODE_ENABLED === 'true');
            if (dcEnabled) {
                console.log('[AuthService] Device-code login enabled. Starting Phase 2 flow.');
                return await this.startDeviceCodeLoginFlow();
            }

            let webUrl = process.env.pickleglass_WEB_URL || 'http://localhost:3000';
            try {
                const u = new URL(webUrl);
                if (!/^https?:$/.test(u.protocol)) throw new Error('invalid protocol');
                webUrl = u.origin;
            } catch (_) {
                webUrl = 'http://localhost:3000';
            }

            const cn = this.generateClientNonce();
            const authUrl = `${webUrl}/login?mode=electron&cn=${encodeURIComponent(cn)}`;
            console.log(`[AuthService] Opening Firebase auth URL in browser: ${authUrl}`);
            await shell.openExternal(authUrl);
            return { success: true };
        } catch (error) {
            console.error('[AuthService] Failed to open Firebase auth URL:', error);
            return { success: false, error: error?.message || String(error) };
        }
    }

    async signInWithCustomToken(token) {
        const auth = getFirebaseAuth();
        try {
            const userCredential = await signInWithCustomToken(auth, token);
            console.log(`[AuthService] Successfully signed in with custom token for user:`, userCredential.user.uid);
            // onAuthStateChanged will handle the state update and broadcast
        } catch (error) {
            console.error('[AuthService] Error signing in with custom token:', error);
            throw error; // Re-throw to be handled by the caller
        }
    }

    async signOut() {
        const auth = getFirebaseAuth();
        try {
            // End all active sessions for the current user BEFORE signing out.
            await sessionRepository.endAllActiveSessions();

            await signOut(auth);
            console.log('[AuthService] User sign-out initiated successfully.');
            // onAuthStateChanged will handle the state update and broadcast,
            // which will also re-evaluate the API key status.
        } catch (error) {
            console.error('[AuthService] Error signing out:', error);
        }
    }
    
    broadcastUserState() {
        const userState = this.getCurrentUser();
        console.log('[AuthService] Broadcasting user state change:', userState);
        BrowserWindow.getAllWindows().forEach(win => {
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                win.webContents.send('user-state-changed', userState);
            }
        });
    }

    getCurrentUserId() {
        return this.currentUserId;
    }

    getCurrentUser() {
        const isLoggedIn = !!(this.currentUserMode === 'firebase' && this.currentUser);

        if (isLoggedIn) {
            return {
                uid: this.currentUser.uid,
                email: this.currentUser.email,
                displayName: this.currentUser.displayName,
                mode: 'firebase',
                isLoggedIn: true,
                authenticationRequired: false
            };
        }
        
        // No local mode fallback - authentication is required
        return {
            uid: null,
            email: null,
            displayName: null,
            mode: 'firebase',
            isLoggedIn: false,
            authenticationRequired: true
        };
    }

    // Helper method to check if user is authenticated
    isAuthenticated() {
        return !!(this.currentUser && this.currentUserId);
    }

    // Helper method to require authentication for operations
    requireAuthentication() {
        if (!this.isAuthenticated()) {
            throw new Error('Authentication required. Please sign in to continue.');
        }
        return this.currentUserId;
    }
}

/**
 * Prototype methods for device registration and settings sync (Phase 1 desktop wiring)
 */
AuthService.prototype.getOrCreateDeviceId = function() {
    if (this.deviceId) return this.deviceId;
    try {
        const existing = this.deviceStore.get('deviceId');
        if (existing && typeof existing === 'string') {
            this.deviceId = existing;
            return this.deviceId;
        }
    } catch (_) {}
    const id = (typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    try { this.deviceStore.set('deviceId', id); } catch (_) {}
    this.deviceId = id;
    return this.deviceId;
};

AuthService.prototype.mapPlatform = function() {
    switch (process.platform) {
        case 'win32': return 'win';
        case 'darwin': return 'mac';
        case 'linux': return 'linux';
        default: return 'linux';
    }
};

AuthService.prototype.registerDevice = async function(user) {
    const db = getFirestoreInstance();
    const deviceId = this.getOrCreateDeviceId();
    const ref = doc(db, 'devices', deviceId);
    const payload = {
        id: deviceId,
        uid: user.uid,
        type: 'desktop',
        platform: this.mapPlatform(),
        appVersion: (app && typeof app.getVersion === 'function') ? app.getVersion() : '0.0.0',
        status: 'online',
        lastSeenAt: serverTimestamp(),
    };
    await setDoc(ref, payload, { merge: true });
    return true;
};

AuthService.prototype.startDeviceHeartbeat = function(intervalMs = 60000) {
    if (this.deviceHeartbeat) return;
    const db = getFirestoreInstance();
    const deviceId = this.getOrCreateDeviceId();
    const ref = doc(db, 'devices', deviceId);
    this.deviceHeartbeat = setInterval(async () => {
        try {
            await updateDoc(ref, {
                lastSeenAt: serverTimestamp(),
                status: 'online',
            });
        } catch (e) {
            console.warn('[AuthService] Heartbeat update failed:', e?.message || e);
        }
    }, intervalMs);
};

AuthService.prototype.stopDeviceHeartbeat = function() {
    if (this.deviceHeartbeat) {
        clearInterval(this.deviceHeartbeat);
        this.deviceHeartbeat = null;
    }
};

AuthService.prototype.startSettingsSubscription = function(uid) {
    try {
        const db = getFirestoreInstance();
        const ref = doc(db, 'users', uid, 'settings', 'app');
        if (this.settingsUnsub) {
            this.settingsUnsub();
            this.settingsUnsub = null;
        }
        this.settingsUnsub = onSnapshot(ref, (snap) => {
            const data = snap.exists() ? snap.data() : {};
            console.log('[AuthService] Settings updated from Firestore:', data);
            try {
                BrowserWindow.getAllWindows().forEach(win => {
                    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                        win.webContents.send('settings-updated', { uid, settings: data });
                    }
                });
            } catch (_) {}
        }, (error) => {
            console.warn('[AuthService] Settings subscription error:', error?.message || error);
        });
    } catch (e) {
        console.warn('[AuthService] Failed to start settings subscription:', e?.message || e);
    }
};

AuthService.prototype.stopSettingsSubscription = function() {
    if (this.settingsUnsub) {
        try { this.settingsUnsub(); } catch (_) {}
        this.settingsUnsub = null;
    }
};

/**
 * Phase 2: Device-code login flow (feature-flagged)
 * Starts device-code, opens verification URI in browser, then polls for approval and signs in with custom token.
 */
AuthService.prototype.startDeviceCodeLoginFlow = async function() {
    // Helper sleep
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

    try {
        const region = process.env.FIREBASE_REGION || process.env.GOOGLE_CLOUD_REGION || 'europe-west1';
        const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pickle-3651a';
        const base = `https://${region}-${project}.cloudfunctions.net`;

        // Start device code
        const startUrl = `${base}/pickleGlassDeviceCodeStart`;
        const startResp = await fetch(startUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interval: 5 })
        });

        if (!startResp.ok) {
            const text = await startResp.text().catch(() => '');
            console.error('[AuthService] Device code start failed:', startResp.status, text);
            return { success: false, error: `device_code_start_failed_${startResp.status}` };
        }

        const startData = await startResp.json();
        const deviceCode = startData?.device_code;
        const verifyUriComplete = startData?.verification_uri_complete;
        const intervalSec = Math.max(3, Number(startData?.interval || 5)); // clamp 3s minimum
        const expiresInSec = Number(startData?.expires_in || 600);

        if (!deviceCode || !verifyUriComplete) {
            console.error('[AuthService] Invalid device code start payload');
            return { success: false, error: 'invalid_device_code_payload' };
        }

        console.log('[AuthService] Opening device verification URI in browser:', verifyUriComplete);
        await shell.openExternal(verifyUriComplete);

        // Prepare polling
        const pollUrl = `${base}/pickleGlassDeviceCodePoll`;
        const startedAt = Date.now();
        const abort = { aborted: false };
        this.deviceCodePollAbort = abort;

        while (!abort.aborted) {
            // Check expiry
            const elapsed = (Date.now() - startedAt) / 1000;
            if (elapsed >= expiresInSec + 5) { // small grace
                console.warn('[AuthService] Device code flow expired');
                this.deviceCodePollAbort = null;
                return { success: false, error: 'expired' };
            }

            // Poll status
            let pollResp, pollJson;
            try {
                pollResp = await fetch(pollUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_code: deviceCode })
                });
                pollJson = await pollResp.json().catch(() => ({}));
            } catch (e) {
                console.warn('[AuthService] Device code poll network error, retrying:', e?.message || e);
                await sleep(intervalSec * 1000);
                continue;
            }

            if (!pollResp.ok) {
                const errCode = pollJson?.error || `http_${pollResp.status}`;
                if (errCode === 'invalid_code') {
                    console.warn('[AuthService] Device code invalid');
                    this.deviceCodePollAbort = null;
                    return { success: false, error: errCode };
                }
                // transient: wait and retry
                await sleep(intervalSec * 1000);
                continue;
            }

            const status = pollJson?.status;
            if (status === 'authorization_pending') {
                await sleep(intervalSec * 1000);
                continue;
            }

            if (status === 'approved' && pollJson?.customToken) {
                try {
                    await this.signInWithCustomToken(pollJson.customToken);
                    console.log('[AuthService] Device-code approved; sign-in initiated.');
                    this.deviceCodePollAbort = null;
                    return { success: true };
                } catch (e) {
                    console.error('[AuthService] Sign-in with custom token failed after device-code approval:', e?.message || e);
                    this.deviceCodePollAbort = null;
                    return { success: false, error: 'sign_in_failed' };
                }
            }

            if (status === 'expired_token' || status === 'already_used') {
                console.warn('[AuthService] Device code flow ended:', status);
                this.deviceCodePollAbort = null;
                return { success: false, error: status };
            }

            // Unknown status: wait and retry
            await sleep(intervalSec * 1000);
        }

        // Aborted externally
        this.deviceCodePollAbort = null;
        return { success: false, error: 'aborted' };
    } catch (error) {
        console.error('[AuthService] Device-code flow error:', error?.message || error);
        this.deviceCodePollAbort = null;
        return { success: false, error: error?.message || String(error) };
    }
};

/**
 * Deep-link client nonce helpers (Phase 1)
 */
AuthService.prototype.generateClientNonce = function() {
    // 16 bytes -> 32 hex chars
    const nonce = (typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID().replace(/-/g, '')
        : crypto.randomBytes(16).toString('hex');
    this.pendingDeepLinkNonce = nonce;
    this.pendingDeepLinkNonceExpAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    try { console.log('[AuthService] Client nonce generated'); } catch (_) {}
    return nonce;
};

AuthService.prototype.verifyAndConsumeClientNonce = function(nonce) {
    if (!nonce || typeof nonce !== 'string') return false;
    if (!this.pendingDeepLinkNonce) return false;
    // Expiry check
    if (this.pendingDeepLinkNonceExpAt && Date.now() > this.pendingDeepLinkNonceExpAt) {
        this.pendingDeepLinkNonce = null;
        this.pendingDeepLinkNonceExpAt = 0;
        try { console.warn('[AuthService] Client nonce expired before verification'); } catch (_) {}
        return false;
    }
    const ok = nonce === this.pendingDeepLinkNonce;
    if (ok) {
        // Consume to avoid replay
        this.pendingDeepLinkNonce = null;
        this.pendingDeepLinkNonceExpAt = 0;
    }
    return ok;
};

const authService = new AuthService();
module.exports = authService;
