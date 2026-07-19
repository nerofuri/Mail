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
  pkg.status = status;
  pkg.updatedAt = ts;
  if (update.estimatedDelivery) pkg.estimatedDelivery = update.estimatedDelivery;

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
