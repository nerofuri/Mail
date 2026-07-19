// Simple file-backed JSON store for shipments.
// Not a real database — good enough for a demo/test tracking portal.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'packages.json');

// Supported carriers. These are used only to label demo shipments — this app
// does NOT connect to any carrier's real systems.
export const CARRIERS = [
  'DHL',
  'FedEx',
  'UPS',
  'USPS',
  'Amazon',
  'AliExpress',
  'eBay',
  'Royal Mail',
  'China Post',
  'Other',
];

// The lifecycle a package moves through.
export const STATUSES = [
  'Label Created',
  'Picked Up',
  'In Transit',
  'Arrived at Facility',
  'Customs Clearance',
  'Out for Delivery',
  'Delivered',
  'Exception',
  'Returned to Sender',
];

let cache = null;

async function ensureFile() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) await writeFile(DATA_FILE, '{}\n', 'utf8');
}

async function load() {
  if (cache) return cache;
  await ensureFile();
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    cache = JSON.parse(raw || '{}');
  } catch {
    cache = {};
  }
  return cache;
}

async function persist() {
  await ensureFile();
  await writeFile(DATA_FILE, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

// Generate a dummy tracking number for a carrier. Purely synthetic — these are
// for testing this portal, not valid numbers on any carrier's network.
export function generateTrackingNumber(carrier = 'Other') {
  const rnd = (len) =>
    Array.from({ length: len }, () =>
      '0123456789'[Math.floor(Math.random() * 10)]
    ).join('');
  const alnum = (len) =>
    Array.from({ length: len }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
    ).join('');

  switch (carrier) {
    case 'DHL':
      // DHL Express air waybills are 10-digit numeric. Synthetic — test only.
      return rnd(10);
    case 'FedEx':
      return rnd(12);
    case 'UPS':
      return '1Z' + alnum(16);
    case 'USPS':
      return '9400' + rnd(18);
    case 'Amazon':
      return 'TBA' + rnd(12);
    case 'AliExpress':
    case 'China Post':
      return 'LP' + rnd(9) + 'CN';
    case 'eBay':
      return 'EB' + rnd(12) + 'US';
    case 'Royal Mail':
      return alnum(2) + rnd(9) + 'GB';
    default:
      return 'TW' + rnd(12);
  }
}

function nowISO() {
  return new Date().toISOString();
}

export async function listPackages() {
  const db = await load();
  return Object.values(db).sort((a, b) =>
    (b.updatedAt || '').localeCompare(a.updatedAt || '')
  );
}

export async function getPackage(trackingNumber) {
  const db = await load();
  return db[String(trackingNumber).toUpperCase()] || null;
}

export async function createPackage(input = {}) {
  const db = await load();
  const carrier = CARRIERS.includes(input.carrier) ? input.carrier : 'Other';

  let trackingNumber = (input.trackingNumber || '').trim().toUpperCase();
  if (!trackingNumber) trackingNumber = generateTrackingNumber(carrier);
  if (db[trackingNumber]) {
    const err = new Error('A shipment with that tracking number already exists.');
    err.status = 409;
    throw err;
  }

  const status = STATUSES.includes(input.status) ? input.status : 'Label Created';
  // Callers (e.g. the seed script) may backdate the initial event; default to now.
  const ts = input.timestamp || nowISO();

  const pkg = {
    trackingNumber,
    carrier,
    status,
    description: input.description || '',
    origin: input.origin || '',
    destination: input.destination || '',
    recipient: input.recipient || '',
    estimatedDelivery: input.estimatedDelivery || '',
    createdAt: ts,
    updatedAt: ts,
    events: [
      {
        status,
        location: input.origin || '',
        note: input.note || 'Shipment information received.',
        timestamp: ts,
      },
    ],
  };

  db[trackingNumber] = pkg;
  await persist();
  return pkg;
}

export async function addEvent(trackingNumber, update = {}) {
  const db = await load();
  const key = String(trackingNumber).toUpperCase();
  const pkg = db[key];
  if (!pkg) {
    const err = new Error('Shipment not found.');
    err.status = 404;
    throw err;
  }

  const status = STATUSES.includes(update.status) ? update.status : pkg.status;
  const ts = update.timestamp || nowISO();

  pkg.events.push({
    status,
    location: update.location || '',
    note: update.note || '',
    timestamp: ts,
  });
  // Current status reflects the newest event by time (so a backdated add
  // doesn't clobber a more recent status).
  const newest = [...pkg.events].sort((a, b) =>
    (b.timestamp || '').localeCompare(a.timestamp || '')
  )[0];
  pkg.status = newest.status;
  pkg.updatedAt = newest.timestamp;
  if (update.estimatedDelivery) pkg.estimatedDelivery = update.estimatedDelivery;

  db[key] = pkg;
  await persist();
  return pkg;
}

// Delete a single event (status update) from a shipment by its index in the
// stored events array. Recomputes the current status from the newest remaining
// event. A shipment must always keep at least one event.
export async function deleteEvent(trackingNumber, index) {
  const db = await load();
  const key = String(trackingNumber).toUpperCase();
  const pkg = db[key];
  if (!pkg) {
    const err = new Error('Shipment not found.');
    err.status = 404;
    throw err;
  }
  if (!Number.isInteger(index) || index < 0 || index >= pkg.events.length) {
    const err = new Error('Invalid update.');
    err.status = 400;
    throw err;
  }
  if (pkg.events.length <= 1) {
    const err = new Error('A shipment must keep at least one update.');
    err.status = 400;
    throw err;
  }

  pkg.events.splice(index, 1);

  // Recompute current status/updatedAt from the newest remaining event.
  const newest = [...pkg.events].sort((a, b) =>
    (b.timestamp || '').localeCompare(a.timestamp || '')
  )[0];
  pkg.status = newest.status;
  pkg.updatedAt = newest.timestamp;

  db[key] = pkg;
  await persist();
  return pkg;
}

// Edit an existing event (status / location / note / timestamp) by index, then
// recompute the shipment's current status from the newest remaining event.
export async function updateEvent(trackingNumber, index, patch = {}) {
  const db = await load();
  const key = String(trackingNumber).toUpperCase();
  const pkg = db[key];
  if (!pkg) {
    const err = new Error('Shipment not found.');
    err.status = 404;
    throw err;
  }
  if (!Number.isInteger(index) || index < 0 || index >= pkg.events.length) {
    const err = new Error('Invalid update.');
    err.status = 400;
    throw err;
  }

  const ev = pkg.events[index];
  if (patch.status !== undefined && STATUSES.includes(patch.status)) ev.status = patch.status;
  if (patch.location !== undefined) ev.location = patch.location;
  if (patch.note !== undefined) ev.note = patch.note;
  if (patch.timestamp) ev.timestamp = patch.timestamp;

  const newest = [...pkg.events].sort((a, b) =>
    (b.timestamp || '').localeCompare(a.timestamp || '')
  )[0];
  pkg.status = newest.status;
  pkg.updatedAt = newest.timestamp;

  db[key] = pkg;
  await persist();
  return pkg;
}

// Replace a shipment's history with a full, realistic simulated journey that
// ends "Delivered". Locations come from the shipment's own origin/destination.
export async function simulateDelivery(trackingNumber) {
  const db = await load();
  const key = String(trackingNumber).toUpperCase();
  const pkg = db[key];
  if (!pkg) {
    const err = new Error('Shipment not found.');
    err.status = 404;
    throw err;
  }

  const origin = pkg.origin || 'Origin facility';
  const dest = pkg.destination || 'Destination';
  // Short, readable destination label (first city-ish segment).
  const destShort = dest.split(',')[0].trim() || dest;
  const country = (s) => (s.split(',').pop() || '').trim().toLowerCase();
  const intl = country(origin) && country(dest) && country(origin) !== country(dest);
  const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

  const journey = [
    { status: 'Label Created', location: origin, note: 'Shipment information received.', h: 132 },
    { status: 'Picked Up', location: origin, note: 'Picked up by courier.', h: 120 },
    { status: 'In Transit', location: origin, note: 'Departed origin facility.', h: 104 },
    { status: 'Arrived at Facility', location: destShort, note: 'Arrived at destination facility.', h: 56 },
  ];
  if (intl) {
    journey.push({ status: 'Customs Clearance', location: destShort, note: 'Import customs clearance completed.', h: 40 });
  }
  journey.push({ status: 'Out for Delivery', location: destShort, note: 'Out for delivery.', h: 8 });
  journey.push({ status: 'Delivered', location: destShort, note: 'Delivered to recipient.', h: 1 });

  pkg.events = journey.map((j) => ({
    status: j.status,
    location: j.location,
    note: j.note,
    timestamp: ago(j.h),
  }));
  pkg.status = 'Delivered';
  pkg.updatedAt = pkg.events[pkg.events.length - 1].timestamp;

  db[key] = pkg;
  await persist();
  return pkg;
}

export async function deletePackage(trackingNumber) {
  const db = await load();
  const key = String(trackingNumber).toUpperCase();
  if (!db[key]) return false;
  delete db[key];
  await persist();
  return true;
}
