#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to seed data.');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const seedPath = path.resolve(process.cwd(), 'supabase', 'seed', 'demo_seed.json');
  const content = JSON.parse(await fs.readFile(seedPath, 'utf8'));

  async function insert(table, rows) {
    if (!rows || !rows.length) return;
    console.log(`Inserting ${rows.length} rows into ${table}`);
    const { data, error } = await supabase.from(table).upsert(rows).select();
    if (error) {
      console.error('Error seeding', table, error.message || error);
      process.exitCode = 1;
    } else {
      console.log(`Inserted ${data?.length || 0} rows into ${table}`);
    }
  }

  // Order matters for FK constraints: clients -> hubs/parkings -> vehicles -> deployments -> driver_assignments -> ops_tasks -> settings -> users
  await insert('clients', content.clients || []);
  await insert('hubs', content.hubs || []);
  await insert('parkings', content.parkings || []);
  await insert('vehicles', content.vehicles || []);
  await insert('deployments', content.deployments || []);
  await insert('driver_assignments', content.driver_assignments || []);
  await insert('ops_tasks', content.ops_tasks || []);
  await insert('settings', content.settings || []);
  await insert('users', content.users || []);

  console.log('Seeding completed.');
}

main();
