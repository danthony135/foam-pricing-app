# Foam App

Factory tool for CP Furniture Manufacturing's foam cutters. Live at
https://foam-app.up.railway.app (Railway project `foam-app`, GitHub
`danthony135/foam-pricing-app`, master auto-deploys).

- **SKUs & Patterns** — every manufactured SKU synced from Odoo, each with its
  foam pattern (pieces: length × width × thickness × qty per slab foam). Push
  writes the board-feet lines onto the SKU's Odoo BOM.
- **Foam Orders / Nests** — a cut list per production list (FurnitureSuite
  schedule = Odoo MOs sharing `x_schedule_number`), or from picked MOs / typed
  SKUs: requirement per slab thickness, on-hand, shortfall, nested slabs, RFQ.
- **Cut Station** — operator screen: pick the production list, then one slab
  at a time to scale with big labels; lay the cardboard templates as pictured,
  cut, tick the slab. Progress is shared across screens.
- **Foam Slabs / Dacron / Inventory** — slab stock (sizes, cost from Odoo).

See `CLAUDE.md` for structure, commands and the migration recipe.
