# TrackWave

A small, self-hosted **multi-carrier package tracking portal**. It gives you:

- A **public tracking page** where you enter a tracking number and see a live
  status timeline.
- An **admin panel** to create shipments, auto-generate dummy tracking numbers
  for testing, and push status updates.
- Support for labelling shipments by carrier — FedEx, UPS, USPS, Amazon,
  AliExpress, eBay, Royal Mail, China Post, and more.

> **Note on scope.** TrackWave is an independent demo/testing tool. It is **not**
> affiliated with, endorsed by, or a clone of any real courier, and it does not
> connect to any carrier's systems. Tracking numbers it generates are synthetic
> and only valid inside this app. It is deliberately its own brand rather than a
> look-alike of a real delivery company.

## Run it

```bash
npm install
npm run seed     # optional: creates a few demo shipments
npm start        # serves http://localhost:3000
```

Then open:

- `http://localhost:3000/` — the tracking page
- `http://localhost:3000/admin.html` — the admin panel

The seed step prints a few ready-made tracking numbers you can paste into the
tracking page.

## Testing the flow

1. Go to **Admin** → *Create a shipment*. Pick a carrier and click **Generate**
   to get a dummy tracking number (or type your own), then **Create shipment**.
2. Copy the tracking number, open the home page, paste it in, and **Track**.
3. Back in Admin → *Update status*, add a new status (e.g. `In Transit` →
   `Out for Delivery` → `Delivered`) with a location and note.
4. Refresh the tracking page — the new event appears at the top of the timeline.

You can also deep-link a shipment: `http://localhost:3000/?tn=YOURNUMBER`.

## How it works

- `server.js` — Express server exposing a small REST API and serving the static
  frontend from `public/`.
- `store.js` — a file-backed JSON store (`data/packages.json`). No database
  required. This is fine for a demo; swap it for a real DB if you productionise.
- `public/` — the tracking page, admin panel, and their styles/scripts.

### API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/meta` | Supported carriers and statuses |
| `GET` | `/api/tracking-number?carrier=FedEx` | A dummy tracking number |
| `GET` | `/api/track/:trackingNumber` | Public: fetch a shipment |
| `GET` | `/api/packages` | Admin: list all shipments |
| `POST` | `/api/packages` | Admin: create a shipment |
| `POST` | `/api/packages/:trackingNumber/events` | Admin: add a status update |
| `DELETE` | `/api/packages/:trackingNumber` | Admin: delete a shipment |

## Statuses

`Label Created` · `Picked Up` · `In Transit` · `Arrived at Facility` ·
`Customs Clearance` · `Out for Delivery` · `Delivered` · `Exception` ·
`Returned to Sender`

## License

MIT
