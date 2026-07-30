// Demo shipment used for the hosted demo. Uses a FIXED tracking number so the
// live URL /?tn=2707796596 works right after a deploy (and after redeploys,
// where an empty store is re-seeded). Built directly so it can use custom
// status labels beyond the standard set.
import { getAll, get, put } from './db.js';

export const DEMO_TN = '2707796596';

// Create the demo shipment with a fixed number. Idempotent: does nothing if
// that number already exists.
export async function seedAtlantaJapan() {
  const existing = await get(DEMO_TN);
  if (existing) return existing;

  const labelTs = '2026-07-17T12:00:00.000Z';
  const flightTs = '2026-07-19T12:00:00.000Z';
  const customsTs = '2026-07-23T12:00:00.000Z';
  const clearedTs = '2026-07-24T12:00:00.000Z';

  const pkg = {
    trackingNumber: DEMO_TN,
    carrier: 'DHL',
    status: 'Customs cleared',
    description: 'International parcel',
    origin: 'Atlanta, GA, USA',
    destination:
      'YAMATO TRANSPORT – Tomakomai Ariake Center, 2-10-10 Ariakecho, Tomakomai, Hokkaido 053-0812, Japan',
    recipient: 'Konomi Fujimoto (Hold for Pickup)',
    estimatedDelivery: '2026-08-12',
    createdAt: labelTs,
    updatedAt: clearedTs,
    events: [
      {
        status: 'Label generated',
        location: 'Atlanta, GA, USA',
        note: 'Shipment label generated.',
        timestamp: labelTs,
      },
      {
        status: 'Awaiting flight',
        location: 'Atlanta, GA, USA',
        note: 'Awaiting flight departure.',
        timestamp: flightTs,
      },
      {
        status: 'Held at customs',
        location: 'Tokyo, JP',
        note: 'Parcel held at Japanese customs for clearance.',
        timestamp: customsTs,
      },
      {
        status: 'Customs cleared',
        location: 'Tokyo, JP',
        note: 'Customs clearance completed.',
        timestamp: clearedTs,
      },
    ],
  };

  await put(pkg);
  return pkg;
}

// On a fresh/empty store (e.g. a new deploy), seed the demo shipment so there's
// something to look at. Never overwrites existing data.
export async function seedDemoIfEmpty() {
  const existing = await getAll();
  if (existing.length > 0) return;
  await seedAtlantaJapan();
  console.log(`Seeded demo shipment ${DEMO_TN} (empty store).`);
}
