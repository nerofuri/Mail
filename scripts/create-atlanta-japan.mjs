// One-off: create the Atlanta -> Tomakomai (Japan) DHL demo shipment.
// Run once with: node scripts/create-atlanta-japan.mjs
import { createPackage, addEvent } from '../store.js';

const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

const pkg = await createPackage({
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

const tn = pkg.trackingNumber;

const journey = [
  ['Picked Up', 'Atlanta, GA, US', 'Shipment picked up by courier.', 172],
  ['Arrived at Facility', 'Atlanta, GA, US', 'Processed at origin service center.', 168],
  ['Departed Facility', 'Cincinnati Hub, US', 'Departed sort facility.', 156, 'In Transit'],
  ['Arrived at Facility', 'Cincinnati Hub, US', 'Arrived at international gateway.', 150],
  ['Departed Facility', 'Cincinnati Hub, US', 'Departed on international flight.', 144, 'In Transit'],
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

for (const [status, location, noteText, hoursAgo, displayStatus] of journey) {
  await addEvent(tn, {
    status: displayStatus || status,
    location,
    note: noteText,
    timestamp: ago(hoursAgo),
  });
}

console.log('Created DHL shipment');
console.log('  Tracking number:', tn);
console.log('  Current status: ', pkg.status, '->', 'Arrived at Facility (held for pickup)');
console.log('  Track at: /?tn=' + tn);
