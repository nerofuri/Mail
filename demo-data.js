// Demo shipment used for the hosted demo. Uses a FIXED tracking number so the
// live URL /?tn=2707796596 works right after a deploy (and after redeploys,
// where the ephemeral data file is empty again).
import { listPackages, getPackage, createPackage, addEvent } from './store.js';

export const DEMO_TN = '2707796596';

const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

// Create the Atlanta -> Tomakomai (Japan) demo shipment with a fixed number.
// Idempotent: does nothing if that number already exists.
export async function seedAtlantaJapan() {
  if (await getPackage(DEMO_TN)) return await getPackage(DEMO_TN);

  const pkg = await createPackage({
    trackingNumber: DEMO_TN,
    carrier: 'DHL',
    status: 'Label Created',
    description: 'International parcel',
    origin: 'Atlanta, GA, USA',
    destination:
      'YAMATO TRANSPORT – Tomakomai Ariake Center, 2-10-10 Ariakecho, Tomakomai, Hokkaido 053-0812, Japan',
    recipient: 'Konomi Fujimoto (Hold for Pickup)',
    estimatedDelivery: '2026-07-22',
    timestamp: ago(180),
    note: 'Shipment information received; label created.',
  });

  const journey = [
    ['Picked Up', 'Atlanta, GA, US', 'Shipment picked up by courier.', 172],
    ['Arrived at Facility', 'Atlanta, GA, US', 'Processed at origin service center.', 168],
    ['In Transit', 'Cincinnati Hub, US', 'Departed sort facility.', 156],
    ['Arrived at Facility', 'Cincinnati Hub, US', 'Arrived at international gateway.', 150],
    ['In Transit', 'Cincinnati Hub, US', 'Departed on international flight.', 144],
    ['Arrived at Facility', 'Tokyo, JP', 'Arrived at destination country (Narita gateway).', 96],
    ['Customs Clearance', 'Tokyo, JP', 'Import customs clearance processing.', 90],
    ['In Transit', 'Tokyo, JP', 'Customs clearance complete; forwarded for delivery.', 72],
    ['Arrived at Facility', 'Sapporo, Hokkaido, JP', 'Arrived at regional facility.', 48],
    ['In Transit', 'Sapporo, Hokkaido, JP', 'Handed to local delivery partner (Yamato Transport).', 30],
    [
      'Arrived at Facility',
      'Tomakomai, Hokkaido, JP',
      'Arrived at YAMATO TRANSPORT – Tomakomai Ariake Center. Held for pickup — ready for collection.',
      6,
    ],
  ];

  for (const [status, location, note, hoursAgo] of journey) {
    await addEvent(DEMO_TN, { status, location, note, timestamp: ago(hoursAgo) });
  }

  return await getPackage(DEMO_TN);
}

// On a fresh/empty store (e.g. a new deploy), seed the demo shipment so there's
// something to look at. Never overwrites existing data.
export async function seedDemoIfEmpty() {
  const existing = await listPackages();
  if (existing.length > 0) return;
  await seedAtlantaJapan();
  console.log(`Seeded demo shipment ${DEMO_TN} (empty store).`);
}
