import { execSync } from 'child_process';

console.log('Starting foam-pricing-app in production...');
execSync('node server/dist/index.js', { stdio: 'inherit', cwd: process.cwd() });
