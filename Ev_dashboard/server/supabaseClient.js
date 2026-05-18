import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Supabase client will not be initialized.');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      realtime: { transport: ws },
    })
  : null;

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

export function getAnonClient() {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !anonKey) throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY not set');
  return createClient(SUPABASE_URL, anonKey, { auth: { persistSession: false }, realtime: { transport: ws } });
}

export function getClient() {
  if (!supabase) throw new Error('Supabase client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  return supabase;
}

// --- Helper methods (minimal, expand as needed) ---
export async function getUserByEmail(email) {
  const db = getClient();
  const { data, error } = await db.from('users').select('*').eq('email', email).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function listVehicles({ limit = 1000, offset = 0 } = {}) {
  const db = getClient();
  const { data, error } = await db.from('vehicles').select('*').range(offset, offset + limit - 1);
  if (error) throw error;
  return data || [];
}

export async function listClientHubs() {
  const db = getClient();
  const { data, error } = await db.from('clients').select('*, hubs(*), parkings(*)');
  if (error) throw error;
  return data || [];
}

export async function listDeployments() {
  const db = getClient();
  const { data, error } = await db.from('deployments').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createDeployment(deployment) {
  const db = getClient();
  const { data, error } = await db.from('deployments').insert(deployment).select();
  if (error) throw error;
  return data?.[0] || null;
}

export async function listDriverAssignments() {
  const db = getClient();
  const { data, error } = await db.from('driver_assignments').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createDriverAssignment(assignment) {
  const db = getClient();
  const { data, error } = await db.from('driver_assignments').insert(assignment).select();
  if (error) throw error;
  return data?.[0] || null;
}

export async function createOpsTask(task) {
  const db = getClient();
  const { data, error } = await db.from('ops_tasks').insert(task).select();
  if (error) throw error;
  return data?.[0] || null;
}

export async function listOpsTasks() {
  const db = getClient();
  const { data, error } = await db.from('ops_tasks').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function markOpsTaskDone(taskId, completedBy) {
  const db = getClient();
  const completedAt = new Date().toISOString();
  const { data, error } = await db
    .from('ops_tasks')
    .update({ status: 'Done', completed_by: completedBy, completed_at: completedAt })
    .eq('task_id', taskId)
    .select()
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function listDrivers() {
  const db = getClient();
  const { data, error } = await db.from('drivers').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createDriver(driver) {
  const db = getClient();
  const { data, error } = await db.from('drivers').insert(driver).select();
  if (error) throw error;
  return data?.[0] || null;
}

export async function updateDriverPhone(driverId, phone) {
  const db = getClient();
  const updatedAt = new Date().toISOString();
  const { data, error } = await db
    .from('drivers')
    .update({ phone, updated_at: updatedAt })
    .eq('driver_id', driverId)
    .select()
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function listParkingSites() {
  const db = getClient();
  const { data, error } = await db.from('parking_sites').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createParkingSite(site) {
  const db = getClient();
  const { data, error } = await db.from('parking_sites').insert(site).select();
  if (error) throw error;
  return data?.[0] || null;
}

export async function getSettings() {
  const db = getClient();
  const { data, error } = await db.from('settings').select('*');
  if (error) throw error;
  const settings = {};
  (data || []).forEach((row) => { settings[row.key] = row.value; });
  return settings;
}

export async function upsertSettings(settingsObj, updatedBy) {
  const db = getClient();
  const rows = Object.keys(settingsObj).map((key) => ({ key, value: String(settingsObj[key]), updated_by: updatedBy, updated_at: new Date().toISOString() }));
  const { error } = await db.from('settings').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
  return true;
}

export default {
  getClient,
  getUserByEmail,
  listVehicles,
  listClientHubs,
  listDeployments,
  createDeployment,
  listDriverAssignments,
  createDriverAssignment,
  createOpsTask,
  listOpsTasks,
  markOpsTaskDone,
  listDrivers,
  createDriver,
  updateDriverPhone,
  listParkingSites,
  createParkingSite,
  getSettings,
  upsertSettings,
  getAnonClient,
  isConfigured,
};
