# TrackWave

A small, self-hosted **multi-carrier package tracking portal**. It gives you:

- A **public tracking page** where you enter a tracking number and see a live
  status timeline.
- An **admin panel** to create shipments, auto-generate dummy tracking numbers
  for testing, and push status updates.
- Support for labelling shipments by carrier — DHL, FedEx, UPS, USPS, Amazon,
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

# Set admin credentials (recommended), then start:
ADMIN_USER=admin ADMIN_PASSWORD='pick-a-strong-password' npm start
# serves http://localhost:3000
```

Then open:

- `http://localhost:3000/` — the public tracking page
- `http://localhost:3000/admin.html` — the admin panel (requires sign in)

## Admin authentication

The admin panel and all write APIs are protected by a username + password.

- Credentials are read from the `ADMIN_USER` and `ADMIN_PASSWORD` environment
  variables. If `ADMIN_PASSWORD` is unset it defaults to `admin` / `changeme`
  and the server prints a warning — fine for a quick local look, **never for
  anything exposed to a network.**
- Signing in sets an `HttpOnly`, `SameSite=Strict` session cookie that lasts
  8 hours. Sessions live in memory, so restarting the server signs everyone out.
- Passwords are compared in constant time. There is no user database — this is a
  single shared admin login, intended for a demo/testing tool. For real
  multi-user auth, put it behind a proper identity provider.

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

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/login` | — | Sign in (sets session cookie) |
| `POST` | `/api/logout` | — | Sign out |
| `GET` | `/api/session` | — | `{ authenticated: bool }` |
| `GET` | `/api/meta` | — | Supported carriers and statuses |
| `GET` | `/api/track/:trackingNumber` | — | Public: fetch a shipment |
| `GET` | `/api/tracking-number?carrier=DHL` | ✅ | A dummy tracking number |
| `GET` | `/api/packages` | ✅ | List all shipments |
| `POST` | `/api/packages` | ✅ | Create a shipment |
| `POST` | `/api/packages/:trackingNumber/events` | ✅ | Add a status update |
| `DELETE` | `/api/packages/:trackingNumber` | ✅ | Delete a shipment |

Routes marked ✅ require the admin session cookie.

## Statuses

`Label Created` · `Picked Up` · `In Transit` · `Arrived at Facility` ·
`Customs Clearance` · `Out for Delivery` · `Delivered` · `Exception` ·
`Returned to Sender`

## License

MIT
