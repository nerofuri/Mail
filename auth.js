// Minimal session auth for the admin panel.
// Credentials come from env vars; sensible (insecure) defaults for local demos.
import crypto from 'node:crypto';

export const COOKIE = 'tw_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    '[auth] ADMIN_PASSWORD is not set — using the default "changeme". ' +
      'Set ADMIN_USER / ADMIN_PASSWORD env vars before deploying anywhere real.'
  );
}

// token -> expiry timestamp (ms). In-memory: sessions clear on restart.
const sessions = new Map();

// Constant-time compare of two strings via fixed-length digests (also avoids
// leaking length differences).
function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}
function safeEqual(a, b) {
  return crypto.timingSafeEqual(digest(a), digest(b));
}

export function checkCredentials(username, password) {
  // Evaluate both comparisons regardless, to avoid short-circuit timing hints.
  const userOk = safeEqual(username, ADMIN_USER);
  const passOk = safeEqual(password, ADMIN_PASSWORD);
  return userOk && passOk;
}

export function createSession() {
  const token = crypto.randomUUID();
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function isValidToken(token) {
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function destroySession(token) {
  if (token) sessions.delete(token);
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((c) => {
        const i = c.indexOf('=');
        if (i < 0) return null;
        return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
      })
      .filter(Boolean)
  );
}

export function tokenFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[COOKIE];
}
