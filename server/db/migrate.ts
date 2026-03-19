import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

migrate(db, {
  migrationsFolder: join(__dirname, 'migrations'),
});

console.log('[db] Migrations applied.');
