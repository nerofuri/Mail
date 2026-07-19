// One-off: create the Atlanta -> Tomakomai (Japan) DHL demo shipment
// (fixed tracking number). Run with: node scripts/create-atlanta-japan.mjs
import { seedAtlantaJapan, DEMO_TN } from '../demo-data.js';

const pkg = await seedAtlantaJapan();
console.log('Demo shipment ready');
console.log('  Tracking number:', DEMO_TN);
console.log('  Current status: ', pkg.status);
console.log('  Track at: /?tn=' + DEMO_TN);
