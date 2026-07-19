// Seed the store with a few demo shipments so you can test right away.
// Run with: npm run seed
import { createPackage, addEvent } from './store.js';

// Helper: an ISO timestamp `hoursAgo` hours before now, so demo timelines
// have realistic, correctly-ordered event times.
const ago = (hoursAgo) =>
  new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();

const demos = [
  {
    carrier: 'AliExpress',
    description: 'Wireless earbuds',
    origin: 'Shenzhen, CN',
    destination: 'London, GB',
    recipient: 'Test User',
    estimatedDelivery: '2026-07-28',
    createdAgo: 168,
    events: [
      { status: 'Picked Up', location: 'Shenzhen, CN', note: 'Accepted by carrier.', hoursAgo: 160 },
      { status: 'In Transit', location: 'Guangzhou, CN', note: 'Departed origin facility.', hoursAgo: 120 },
      { status: 'Customs Clearance', location: 'London Heathrow, GB', note: 'Import customs clearance.', hoursAgo: 12 },
    ],
  },
  {
    carrier: 'FedEx',
    description: 'Laptop stand',
    origin: 'Memphis, US',
    destination: 'Austin, US',
    recipient: 'Test User',
    estimatedDelivery: '2026-07-21',
    createdAgo: 48,
    events: [
      { status: 'Picked Up', location: 'Memphis, US', hoursAgo: 40 },
      { status: 'In Transit', location: 'Dallas, US', hoursAgo: 18 },
      { status: 'Out for Delivery', location: 'Austin, US', note: 'On the delivery vehicle.', hoursAgo: 3 },
    ],
  },
  {
    carrier: 'Amazon',
    description: 'USB-C cable (2m)',
    origin: 'Leipzig, DE',
    destination: 'Paris, FR',
    recipient: 'Test User',
    estimatedDelivery: '2026-07-19',
    createdAgo: 30,
    events: [
      { status: 'In Transit', location: 'Leipzig, DE', hoursAgo: 26 },
      { status: 'Out for Delivery', location: 'Paris, FR', hoursAgo: 8 },
      { status: 'Delivered', location: 'Paris, FR', note: 'Left with resident.', hoursAgo: 2 },
    ],
  },
];

for (const demo of demos) {
  const { events, createdAgo, ...base } = demo;
  const pkg = await createPackage({ ...base, timestamp: ago(createdAgo) });
  for (const ev of events) {
    const { hoursAgo, ...rest } = ev;
    await addEvent(pkg.trackingNumber, { ...rest, timestamp: ago(hoursAgo) });
  }
  console.log(`Seeded ${pkg.carrier} ${pkg.trackingNumber} → ${pkg.status}`);
}

console.log('\nDone. Start the server (npm start) and try one of the numbers above.');
