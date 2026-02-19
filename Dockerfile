FROM node:20-slim AS build

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
COPY scripts scripts
COPY server/prisma server/prisma

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY scripts scripts
COPY server/prisma server/prisma

RUN npm ci --omit=dev

COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma node_modules/@prisma

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy --schema=server/prisma/schema.prisma && node scripts/start.mjs"]
