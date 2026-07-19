import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CARRIERS,
  STATUSES,
  listPackages,
  getPackage,
  createPackage,
  addEvent,
  deletePackage,
  generateTrackingNumber,
} from './store.js';
import {
  COOKIE,
  checkCredentials,
  createSession,
  destroySession,
  isValidToken,
  tokenFromRequest,
} from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- Auth middleware ------------------------------------------------------
function requireAuth(req, res, next) {
  if (isValidToken(tokenFromRequest(req))) return next();
  res.status(401).json({ error: 'Authentication required.' });
}

// Gate the admin page before static serving: redirect to login if not signed in.
app.get('/admin.html', (req, res, next) => {
  if (isValidToken(tokenFromRequest(req))) return next();
  res.redirect('/login.html');
});

app.post('/api/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  if (!checkCredentials(username, password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const token = createSession();
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 8,
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  destroySession(tokenFromRequest(req));
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  res.json({ authenticated: isValidToken(tokenFromRequest(req)) });
});

app.use(express.static(join(__dirname, 'public')));

// --- Metadata -------------------------------------------------------------
app.get('/api/meta', (_req, res) => {
  res.json({ carriers: CARRIERS, statuses: STATUSES });
});

// Suggest a dummy tracking number for a given carrier (for testing).
app.get('/api/tracking-number', requireAuth, (req, res) => {
  const carrier = req.query.carrier || 'Other';
  res.json({ trackingNumber: generateTrackingNumber(carrier), carrier });
});

// --- Public tracking ------------------------------------------------------
app.get('/api/track/:trackingNumber', async (req, res) => {
  try {
    const pkg = await getPackage(req.params.trackingNumber);
    if (!pkg) return res.status(404).json({ error: 'Shipment not found.' });
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin: list / create / update / delete -------------------------------
app.get('/api/packages', requireAuth, async (_req, res) => {
  try {
    res.json(await listPackages());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/packages', requireAuth, async (req, res) => {
  try {
    const pkg = await createPackage(req.body || {});
    res.status(201).json(pkg);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/packages/:trackingNumber/events', requireAuth, async (req, res) => {
  try {
    const pkg = await addEvent(req.params.trackingNumber, req.body || {});
    res.json(pkg);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/packages/:trackingNumber', requireAuth, async (req, res) => {
  try {
    const ok = await deletePackage(req.params.trackingNumber);
    if (!ok) return res.status(404).json({ error: 'Shipment not found.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`TrackWave running at http://localhost:${PORT}`);
});
