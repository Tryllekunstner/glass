/**
 * Deep Link Utilities (Phase 1)
 * - Generates pickleglass:// URIs with a cryptographically strong nonce
 * - Encodes minimal payload safely
 * - Does NOT persist or verify nonce (verification is handled by desktop in Phase 1 and will be
 *   upgraded server-side in Phase 2 when we move to device-code/PKCE-like flow)
 * - Region-aware via environment (for logging/diagnostics only)
 *
 * Default scheme: pickleglass://
 * Example: pickleglass://login?nonce=...&token=...&returnTo=%2F
 */

const crypto = require('crypto');

function getRegion() {
  return process.env.REGION ||
         process.env.FIREBASE_REGION ||
         process.env.GOOGLE_CLOUD_REGION ||
         'europe-west1';
}

function getAppScheme() {
  const scheme = process.env.DEEPLINK_SCHEME || 'pickleglass';
  // Basic scheme validation
  if (!/^[a-z][a-z0-9+\-.]*$/i.test(scheme)) {
    return 'pickleglass';
  }
  return scheme;
}

function safeBase64(input) {
  // Produce URL-safe base64 without padding
  return Buffer.from(input, 'utf8').toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createNonce(bytes = 16) {
  // Hex-encoded 128-bit (default) random value
  return crypto.randomBytes(bytes).toString('hex');
}

function clamp(str, max = 2048) {
  if (typeof str !== 'string') return '';
  return str.length > max ? str.slice(0, max) : str;
}

function buildQuery(params) {
  // Only include defined and non-empty values
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

/**
 * Generate a deep link for desktop authentication continuation
 * @param {Object} options
 * @param {string} [options.action='login'] - Path/verb for the deep link (e.g., 'login')
 * @param {string} [options.nonce] - Nonce to include; will be generated if not provided
 * @param {string} [options.token] - Optional short-lived token or code (keep minimal in Phase 1)
 * @param {string} [options.returnTo] - Optional return path to navigate after desktop completes
 * @param {Record<string, string>} [options.extra] - Optional extra query params (kept minimal)
 * @returns {string} pickleglass:// URI
 */
function generateDeepLink(options = {}) {
  const action = (options.action || 'login').replace(/[^a-zA-Z0-9/_-]/g, '');
  const nonce = options.nonce || createNonce(16);

  // Keep payload minimal in Phase 1
  const token = options.token ? clamp(options.token, 2048) : undefined;
  const returnTo = options.returnTo ? clamp(options.returnTo, 512) : undefined;

  // Allow a tiny set of extra params if explicitly provided
  const extra = options.extra && typeof options.extra === 'object' ? options.extra : undefined;

  const query = buildQuery({
    nonce,
    token,
    returnTo,
    ...extra
  });

  const scheme = getAppScheme();
  const path = action.startsWith('/') ? action.slice(1) : action;

  const uri = `${scheme}://${path}${query ? `?${query}` : ''}`;

  // Lightweight diagnostic (non-PII)
  try {
    const diag = {
      region: getRegion(),
      scheme,
      path,
      hasToken: !!token,
      hasReturnTo: !!returnTo,
      queryLength: query.length,
    };
    // eslint-disable-next-line no-console
    console.log('🔗 Generated deep link:', JSON.stringify(diag));
  } catch (_) {}

  return uri;
}

/**
 * Attach deep link nonce headers to a response for client correlation
 * This does not set cookies; it only surfaces headers for telemetry/correlation.
 * @param {import('express').Response} res
 * @param {string} nonce
 */
function setDeepLinkHeaders(res, nonce) {
  try {
    res.setHeader('X-DeepLink-Nonce', String(nonce));
    res.setHeader('X-DeepLink-Region', getRegion());
  } catch (_) {}
}

module.exports = {
  createNonce,
  generateDeepLink,
  setDeepLinkHeaders,
  getRegion,
  getAppScheme,
  safeBase64,
};
