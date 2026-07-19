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

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// --- Metadata -------------------------------------------------------------
app.get('/api/meta', (_req, res) => {
  res.json({ carriers: CARRIERS, statuses: STATUSES });
});

// Suggest a dummy tracking number for a given carrier (for testing).
app.get('/api/tracking-number', (req, res) => {
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
app.get('/api/packages', async (_req, res) => {
  try {
    res.json(await listPackages());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/packages', async (req, res) => {
  try {
    const pkg = await createPackage(req.body || {});
    res.status(201).json(pkg);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/packages/:trackingNumber/events', async (req, res) => {
  try {
    const pkg = await addEvent(req.params.trackingNumber, req.body || {});
    res.json(pkg);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/packages/:trackingNumber', async (req, res) => {
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
