# Foam App (CP Furniture Manufacturing)

Factory tool for the foam cutters. Not a pricing app any more — the quoting,
customers, pricing rules and AI pricing chat were removed on 2026-09-06.

What it does:
- Syncs manufactured SKUs and slab foam products (board feet) from Odoo.
- Holds the foam pattern per SKU (pieces L × W × thickness × qty, per slab foam)
  and pushes the board-feet lines onto the SKU's Odoo BOM. A piece can be a
  rectangle or a shaped outline (polygon in inches, y-down, normalized to 0,0):
  presets (T-cushion, wedge, notch, trapezoid, rounded end, L), DXF import
  (`services/dxf.ts`), or a photo trace of the cardboard template (client,
  `lib/shapes.ts`). Board feet use the true outline area.
- Nesting (`services/cutOptimizer.ts`): bottom-left on a ¼" occupancy grid,
  corner + 2" lattice candidates, 4 rotations for shapes, exact rasterized
  overlap test with a ¼" kerf ring; shapes interlock. `scripts/test-nest.mjs`
  sanity-checks it against the built server.
- Builds a cut list from a FurnitureSuite production list (Odoo MOs sharing an
  `x_schedule_number`), or from picked MOs / typed SKUs; nests the pieces onto
  slabs per thickness; drafts an RFQ to the foam vendor for shortfall.
- Cut Station: the operator picks their production list, then works slab by
  slab from a to-scale picture (cardboard templates), ticking slabs off.
- Remnants (`services/remnants.ts`, `/remnants`): ticking a slab off shelves
  its usable free rectangles (≥ 6" sides, ≥ 1 sq ft) as `Remnant` rows; other
  leftovers are scanned (photo → outline via `traceImage`, scaled by one tape
  measurement of the longest side) or typed in. Matching nests the pieces still
  to cut on open lists onto the remnant's real outline (`packPieces` with
  `stockPoly` + `maxSheets: 1`, no glue) and lists every pattern of that foam
  that fits. Claiming records `FoamOrder.remnantCuts`, re-nests only the
  UNTICKED slabs (ticked ones are kept verbatim and renumbered first; shelved
  remnants follow the renumbering), marks the remnant used and shelves its own
  leftovers. Thickness is never measured — the operator picks the foam.
- Camera measurement (`components/foam/MeasureSlab.tsx`, remnant scan): the
  traced outline gets a best-fit minimum-area rectangle (`minAreaRect` in
  `lib/shapes.ts`, rotating calipers on the convex hull) — never an
  axis-aligned bbox, which over-reads a crooked slab. That gives true length
  × width, the angle of the long side and the origin corner. The outline is
  expressed in the slab's own frame (`toLocal`) for nesting/pictures; the
  sheet's `stock` keeps `x`, `y`, `angle` and the projector (`Projector.tsx`
  `P()`) rotates + offsets the nest onto the foam where it lies.
- Cutting is size-free: slab sizes per foam (default 108 × 84, what we buy)
  are only planning defaults for the initial nest / RFQ. On the table the
  operator hits "Scan stock on table" and whatever foam is there (full slab,
  short slab, remnant of any shape, any angle) is traced, nested and projected
  (`slabResize.ts`): a full slab keeps its planned pieces; a partial slab or
  remnant (`fill`) is filled from every unticked piece of that foam and the
  rest of the plan is rebuilt behind it.
- Calibration (`/settings/projection`): the reference rectangle is the TABLE
  (projection area, default 120 × 120, corner in the stops = (0,0)), not a
  slab. Thickness planes are marked with a tape-measured "calibration slab"
  in the stops (default 108 × 84) and its four corners are extrapolated to the
  table corners through the homography (`extrapolateCorners`). The projected
  image must cover the whole table area; otherwise set the table size to the
  part it covers.

## Project Structure
- npm workspaces: `server/` (Express + TypeScript + Prisma/SQLite) and
  `client/` (React + Vite + Tailwind v4 + shadcn/ui).
- `server/src/services/odoo.ts` JSON-2 client · `odooSync.ts` SKUs/materials/
  schedules/BOM push/RFQ · `cutOptimizer.ts` slab nesting ·
  `foamRequirements.ts` requirement + plan per order.
- Routes: `/api/skus`, `/api/odoo`, `/api/foam-orders`, `/api/foams`,
  `/api/dacrons`, `/api/inventory`, `/api/scrap`, `/api/remnants`.

## Commands
- `npm run dev` — server (3001) + client (5173)
- `npm run build` — client then server
- `npm start` — `scripts/start.mjs`: seeds the SQLite file on first boot,
  runs `prisma migrate deploy`, starts the server
- New migration (Prisma refuses `migrate dev` non-interactively):
  `npx prisma migrate diff --from-url "file:<abs path to dev.db>" --to-schema-datamodel server/prisma/schema.prisma --script > server/prisma/migrations/<stamp>_<name>/migration.sql`
  then `DATABASE_URL=file:./dev.db npx prisma migrate deploy --schema=server/prisma/schema.prisma`

## Env
`DATABASE_URL` (file:/data/foam.db on Railway), `ODOO_URL`, `ODOO_DB`,
`ODOO_API_KEY`, `ODOO_SYNC_INTERVAL_MIN`. Keep only the root `.env` locally
(a second one under `server/prisma` conflicts).

## Deploy
Railway project/service `foam-app`, https://foam-app.up.railway.app, master
auto-deploys (Dockerfile build).
