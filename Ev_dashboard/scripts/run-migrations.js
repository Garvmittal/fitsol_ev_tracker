#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Client } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    console.error('Set DATABASE_URL (Postgres connection string) to run migrations.');
    process.exit(1);
  }
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      console.log('Running migration:', file);
      await client.query(sql);
    }
    console.log('Migrations completed.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
