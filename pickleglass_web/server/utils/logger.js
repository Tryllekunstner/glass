const os = require('os');

function getRegion() {
  return (
    process.env.REGION ||
    process.env.FIREBASE_REGION ||
    process.env.GOOGLE_CLOUD_REGION ||
    'europe-west1'
  );
}

function baseLog(level, message, extra = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    service: 'pickleglass-web',
    env: process.env.NODE_ENV || 'development',
    region: getRegion(),
    msg: message,
    ...extra,
  };

  // Use console methods for compatibility with Cloud Run/App Hosting log ingestion
  if (level === 'error') {
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

function logInfo(message, extra) {
  baseLog('info', message, extra);
}

function logWarn(message, extra) {
  baseLog('warn', message, extra);
}

function logError(message, extra) {
  baseLog('error', message, extra);
}

/**
 * Structured request logging middleware
 * - Emits a single JSON log line per request on finish
 * - Includes correlation ID, auth headers (summaries), and duration
 */
function attachRequestLogger() {
  return function requestLogger(req, res, next) {
    const start = process.hrtime.bigint ? process.hrtime.bigint() : Date.now();
    const cid =
      req.correlationId ||
      req.headers['x-request-id'] ||
      req.headers['x-correlation-id'] ||
      null;

    // Emit one structured log line when the response finishes
    res.on('finish', () => {
      const end = process.hrtime.bigint ? process.hrtime.bigint() : Date.now();
      const durationMs =
        typeof start === 'bigint' && typeof end === 'bigint'
          ? Number(end - start) / 1e6
          : end - start;

      const contentLength = res.getHeader('content-length');
      const authChecked = res.getHeader('X-Auth-Checked') || undefined;
      const authMode = res.getHeader('X-Auth-Mode') || undefined;
      const userAuthed = res.getHeader('X-User-Authenticated') || undefined;

      baseLog('info', 'http_request', {
        cid,
        method: req.method,
        path: req.path || req.url,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        contentLength: contentLength ? Number(contentLength) : undefined,
        auth: {
          checked: authChecked === 'true' || authChecked === true,
          mode: authMode || null,
          userAuthenticated: userAuthed === 'true' || userAuthed === true,
        },
      });
    });

    next();
  };
}

module.exports = {
  logInfo,
  logWarn,
  logError,
  attachRequestLogger,
};
