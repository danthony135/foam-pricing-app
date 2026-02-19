import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const schemaPath = resolve('server/prisma/schema.prisma');
if (existsSync(schemaPath)) {
  console.log('Generating Prisma client...');
  execSync(`npx prisma generate --schema=${schemaPath}`, { stdio: 'inherit' });
} else {
  console.warn('Prisma schema not found, skipping generate.');
}
