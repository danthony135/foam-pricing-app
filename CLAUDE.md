# Foam Pricing App

## Project Structure
- **Monorepo**: npm workspaces with `server/` and `client/`
- **Server**: Express + TypeScript + Prisma (PostgreSQL)
- **Client**: React + Vite + Tailwind CSS v4 + shadcn/ui

## Key Commands
- `npm run dev` — Start both server (3001) and client (5173) in dev mode
- `npm run build` — Build client then server for production
- `npm start` — Run production server (serves client build as static)
- `npm run prisma:migrate` — Apply database migrations
- `npm run prisma:seed` — Seed default settings and sample data

## Pricing Formula
```
Total = ((Material + Labor) × (1 + Overhead%) × (1 + IndirectLabor%)) × (1 + Markup%) + Shipping
```
- Material = (BoardFeet w/ tolerance × Foam $/BF) + (Dacron SqFt w/ tolerance × Dacron $/SqFt)
- Board Feet = L × W × H / 144
- Tolerance applied per dimension: dim × (1 + tolerance%)
- Labor = MakeTime (hrs) × HourlyRate
- Shipping = BoardFeet × Customer ShippingRate/BF

## API Conventions
- All routes under `/api/`
- RESTful CRUD: GET (list), GET/:id, POST, PUT/:id, DELETE/:id
- Pricing endpoint: POST `/api/pricing/calculate`
- AI chat: POST `/api/ai/chat`

## Database
- PostgreSQL via Prisma ORM
- Schema at `server/prisma/schema.prisma`
- Singleton patterns for LaborSettings and OverheadSettings (upsert with id=1)
