import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

// SQLite on Railway lives on a volume (DATABASE_URL=file:/data/foam.db). On the
// very first boot the volume is empty, so seed it from the checked-in seed.db
// (foam/dacron/customer defaults, a copy of the Feb-2026 dev.db) before migrations run.
const url = process.env.DATABASE_URL || 'file:./dev.db';
if (url.startsWith('file:')) {
  const target = url.slice(5).startsWith('/') ? url.slice(5) : resolve('server/prisma', url.slice(5));
  const seed = resolve('server/prisma/seed.db');
  if (!existsSync(target)) {
    mkdirSync(dirname(target), { recursive: true });
    if (existsSync(seed) && seed !== target) {
      copyFileSync(seed, target);
      console.log(`Seeded database at ${target} from bundled seed.db`);
    }
  }
}

console.log('Applying migrations...');
execSync('npx prisma migrate deploy --schema=server/prisma/schema.prisma', { stdio: 'inherit' });

console.log('Starting foam-pricing-app in production...');
execSync('node server/dist/index.js', { stdio: 'inherit', cwd: process.cwd() });
