import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const staticLoginOtp = String(import.meta.env.VITE_STATIC_LOGIN_OTP || '123456').trim();
const staticLoginPassword = String(import.meta.env.VITE_STATIC_LOGIN_PASSWORD || staticLoginOtp).trim();
const staticLoginEnabled = Boolean(staticLoginOtp);

export const supabaseDirectEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseDirectEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function supabaseApiJson(url, options = {}) {
  if (!supabase) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.');
  const method = String(options.method || 'GET').toUpperCase();
  const body = parseBody(options.body);
  const path = String(url || '').split('?')[0];
  const query = new URLSearchParams(String(url || '').split('?')[1] || '');

  if (path === '/api/auth/request-otp' && method === 'POST') return requestOtp(body);
  if (path === '/api/auth/verify-otp' && method === 'POST') return verifyOtp(body);
  if (path === '/api/auth/me' && method === 'GET') return authMe();
  if (path === '/api/auth/logout' && method === 'POST') return logout();
  if (path === '/api/config' && method === 'GET') return config();

  const user = await requirePortalUser();

  if (path === '/api/fleet' && method === 'GET') return getFleet(user);
  if (path === '/api/client-hubs' && method === 'GET') return getClientHubs(user);
  if (path === '/api/client-hubs' && method === 'POST') return saveClientHubs(body, user);
  if (path === '/api/deployments' && method === 'POST') return createDeployment(body, user);
  if (path === '/api/deployments/remove' && method === 'POST') return removeDeployment(body, user);
  if (path === '/api/deployments/end' && method === 'POST') return scheduleDeploymentEnd(body, user);
  if (path === '/api/driver-assignments' && method === 'GET') return getDriverAssignments(user);
  if (path === '/api/driver-assignments' && method === 'POST') return createDriverAssignment(body, user);
  if (path === '/api/drivers' && method === 'GET') return getDrivers(user);
  if (path === '/api/drivers' && method === 'POST') return createDriver(body, user);
  if (path.startsWith('/api/drivers/') && method === 'PATCH') return updateDriver(path, body, user);
  if (path === '/api/parking-sites' && method === 'GET') return getParkingSites(user);
  if (path === '/api/parking-sites' && method === 'POST') return createParkingSite(body, user);
  if (path === '/api/driver-session' && method === 'POST') return updateDriverSession(body, user);
  if (path === '/api/tasks' && method === 'GET') return getTasks(user);
  if (path.startsWith('/api/tasks/') && path.endsWith('/done') && method === 'POST') return markTaskDone(path, user);
  if (path === '/api/settings' && method === 'GET') return getSettings();
  if (path === '/api/settings' && method === 'POST') return saveSettings(body, user);
  if (path === '/api/carbon-trend' && method === 'GET') return getCarbonTrend(query.get('period'));
  if (path === '/api/alerts/preview' && method === 'GET') return getAlertPreview(user);
  if (path === '/api/alerts/send' && method === 'POST') return sendAlertsDryRun(user);
  if (path === '/api/reverse-geocode' && method === 'GET') return { ok: true, place: '' };

  throw new Error(`Supabase endpoint not implemented: ${method} ${path}`);
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

async function requestOtp(body) {
  const email = normalizeEmail(body.email);
  if (!email) throw new Error('Email is required');
  if (staticLoginEnabled) return { ok: true, delivery: 'static-otp' };

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw new Error(error.message || 'Unable to send OTP');
  return { ok: true, delivery: 'supabase' };
}

async function verifyOtp(body) {
  const email = normalizeEmail(body.email);
  const token = String(body.otp || '').trim();
  if (!email || !token) throw new Error('Email and OTP are required');

  if (staticLoginEnabled) {
    if (token !== staticLoginOtp) throw new Error('Invalid OTP');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: staticLoginPassword,
    });
    if (error) {
      throw new Error(
        'Static OTP matched, but Supabase password login failed. Set this Auth user password to VITE_STATIC_LOGIN_PASSWORD or the static OTP.'
      );
    }
    const user = await getPortalUserByEmail(data.user?.email || email);
    if (!user) {
      await supabase.auth.signOut();
      throw new Error('This email is not allowed for dashboard access');
    }
    return { user };
  }

  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new Error(error.message || 'Invalid or expired OTP');
  const user = await getPortalUserByEmail(data.user?.email || email);
  if (!user) {
    await supabase.auth.signOut();
    throw new Error('This email is not allowed for dashboard access');
  }
  return { user };
}

async function authMe() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const email = data.session?.user?.email;
  if (!email) throw new Error('Not signed in');
  const user = await getPortalUserByEmail(email);
  if (!user) {
    await supabase.auth.signOut();
    throw new Error('This email is not allowed for dashboard access');
  }
  return { user, authRequired: true };
}

async function logout() {
  await supabase.auth.signOut();
  return { ok: true };
}

function config() {
  return {
    googleMaps: {
      enabled: Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
      apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
      mapId: import.meta.env.VITE_GOOGLE_MAP_ID || '',
      missing: {
        apiKey: !import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        mapId: !import.meta.env.VITE_GOOGLE_MAP_ID,
      },
    },
  };
}

async function requirePortalUser() {
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user?.email;
  if (!email) throw new Error('Not signed in');
  const user = await getPortalUserByEmail(email);
  if (!user) throw new Error('This email is not allowed for dashboard access');
  return user;
}

async function getPortalUserByEmail(email) {
  const normalized = normalizeEmail(email);
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', normalized)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.active === false) return null;
  return normalizeUser(data, normalized);
}

function normalizeUser(row, email) {
  const role = String(row.role || 'client').toLowerCase();
  const explicitPermissions = Array.isArray(row.permissions) ? row.permissions.filter(Boolean) : [];
  return {
    name: row.name || email,
    email,
    role,
    client: row.client || '',
    permissions: explicitPermissions.length ? explicitPermissions : permissionsForRole(role),
  };
}

async function getFleet(user) {
  const [{ data: vehicles, error }, deployments, assignments, snapshots, settingsPayload] = await Promise.all([
    supabase.from('vehicles').select('*').order('last_updated', { ascending: false }),
    listRows('deployments', 'created_at', false),
    listRows('driver_assignments', 'created_at', false),
    listTodaySnapshots(),
    getSettings(),
  ]);
  if (error) throw error;
  const latestDeployments = latestByKey((deployments || []).filter((row) => row.status !== 'Removed'), 'vehicle', 'created_at');
  const latestAssignments = latestByKey(assignments || [], 'vehicle', 'created_at');
  const latestSnapshots = latestSnapshotByVehicle(snapshots || []);
  const settings = settingsPayload?.settings || normalizeSettings();
  const rows = scopeRows(vehicles || [], user).map((vehicle, index) => (
    mergeVehicleOpsData(
      normalizeVehicle(vehicle, index, latestSnapshots.get(vehicleKey(vehicle.id)), settings),
      latestDeployments.get(vehicleKey(vehicle.id)),
      latestAssignments.get(vehicleKey(vehicle.id)),
      index,
    )
  ));
  return { vehicles: rows, updatedAt: new Date().toISOString() };
}

async function getClientHubs(user) {
  requirePermission(user, 'fleet');
  const { data, error } = await supabase
    .from('clients')
    .select('*, hubs(*), parkings(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return { clients: (data || []).map(normalizeClient) };
}

async function saveClientHubs(body, user) {
  requirePermission(user, 'deployments');
  const clientName = String(body.client || '').trim();
  if (!clientName) throw new Error('Client is required');
  const { data: client, error } = await supabase
    .from('clients')
    .upsert({
      name: clientName,
      gst_number: body.gstNumber || '',
      poc: body.clientPoc || '',
    }, { onConflict: 'name' })
    .select()
    .single();
  if (error) throw error;

  const hubs = parseLocationLines(body.hubs).map((hub) => ({
    client_id: client.id,
    name: hub.name,
    gmp_link: hub.gmpLink,
    lat: hub.lat,
    lng: hub.lng,
    enabled: true,
  }));
  const parkings = parseLocationLines(body.parkings).map((parking) => ({
    client_id: client.id,
    name: parking.name,
    gmp_link: parking.gmpLink,
    lat: parking.lat,
    lng: parking.lng,
    enabled: true,
  }));
  if (hubs.length) {
    const { error: hubError } = await supabase.from('hubs').insert(hubs);
    if (hubError) throw hubError;
  }
  if (parkings.length) {
    const { error: parkingError } = await supabase.from('parkings').insert(parkings);
    if (parkingError) throw parkingError;
  }
  return getClientHubs(user);
}

async function getDrivers(user) {
  requirePermission(user, 'drivers');
  const rows = await listRows('drivers', 'created_at', false);
  return { drivers: (rows || []).map(normalizeDriver) };
}

async function createDriver(body, user) {
  requirePermission(user, 'drivers');
  const row = {
    driver_id: cryptoRandomId(),
    name: String(body.name || '').trim(),
    phone: String(body.phone || '').trim(),
    license_number: String(body.licenseNumber || '').trim(),
    dob: body.dob || '',
    email: normalizeEmail(body.email),
    created_by: user.email,
    created_at: new Date().toISOString(),
  };
  const duplicateMessage = await findDuplicateDriverMessage(row);
  if (duplicateMessage) throw new Error(duplicateMessage);
  const { error } = await supabase.from('drivers').insert(row);
  if (error) throw new Error(driverPersistenceErrorMessage(error));
  return getDrivers(user);
}

async function updateDriver(path, body, user) {
  requirePermission(user, 'drivers');
  const driverId = decodeURIComponent(path.split('/').pop() || '');
  const phone = String(body.phone || '').trim();
  const duplicateMessage = await findDuplicateDriverMessage({ phone }, driverId);
  if (duplicateMessage) throw new Error(duplicateMessage);
  const { error } = await supabase
    .from('drivers')
    .update({ phone, updated_at: new Date().toISOString() })
    .eq('driver_id', driverId);
  if (error) throw new Error(driverPersistenceErrorMessage(error));
  return getDrivers(user);
}

async function getParkingSites(user) {
  requirePermission(user, 'deployments');
  const rows = await listRows('parking_sites', 'created_at', false);
  return { parkings: (rows || []).map(normalizeParkingSite) };
}

async function createParkingSite(body, user) {
  requirePermission(user, 'deployments');
  const coords = extractMapCoords(body.gmpLink);
  const row = {
    parking_id: cryptoRandomId(),
    name: body.name || '',
    location: body.location || '',
    gmp_link: body.gmpLink || '',
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    created_by: user.email,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('parking_sites').insert(row);
  if (error) throw error;
  return getParkingSites(user);
}

async function createDeployment(body, user) {
  requirePermission(user, 'deployments');
  const deployment = {
    deployment_id: cryptoRandomId(),
    vehicle: body.vehicle || '',
    client: body.client || '',
    hub: body.hub || '',
    hub_gmp_link: body.hubGmpLink || '',
    hub_lat: numberOrNull(body.hubLat),
    hub_lng: numberOrNull(body.hubLng),
    parking: body.parking || '',
    parking_gmp_link: body.parkingGmpLink || '',
    parking_lat: numberOrNull(body.parkingLat),
    parking_lng: numberOrNull(body.parkingLng),
    previous_undeploy_at: body.previousUndeployAt || '',
    deploy_at: body.deployAt || null,
    layover_parking: body.layoverParking || '',
    layover_parking_gmp_link: body.layoverParkingGmpLink || '',
    layover_parking_lat: numberOrNull(body.layoverParkingLat),
    layover_parking_lng: numberOrNull(body.layoverParkingLng),
    usage: body.usage || '',
    poc: body.poc || '',
    status: 'Active',
    created_by: user.email,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('deployments').insert(deployment);
  if (error) throw error;
  const tasks = await createDeploymentTasks(deployment, user);
  return { ok: true, deployment: normalizeDeployment(deployment), tasks };
}

async function removeDeployment(body, user) {
  requirePermission(user, 'deployments');
  const vehicle = String(body.vehicle || '').trim().toUpperCase();
  if (!vehicle) throw new Error('Vehicle is required');
  const { error } = await supabase
    .from('deployments')
    .update({
      status: 'Removed',
      removed_by: user.email,
      removed_at: new Date().toISOString(),
      remove_reason: body.reason || '',
    })
    .eq('vehicle', vehicle)
    .eq('status', 'Active');
  if (error) throw error;
  return { ok: true };
}

async function scheduleDeploymentEnd(body, user) {
  requirePermission(user, 'deployments');
  const task = await createOpsTask({
    title: 'End deployment and move vehicle',
    vehicle: body.vehicle || '',
    client: '',
    hub: '',
    parking: body.parking || '',
    poc: body.driverChoice || '',
    due: body.effectiveAt || '',
    reason: body.reason || 'Scheduled undeploy',
    status: 'Pending',
  }, user);
  return { ok: true, task };
}

async function getDriverAssignments(user) {
  requirePermission(user, ['drivers', 'driver']);
  const rows = await listRows('driver_assignments', 'created_at', false);
  return { assignments: scopeRows(rows || [], user).map(normalizeDriverAssignment) };
}

async function createDriverAssignment(body, user) {
  requirePermission(user, 'drivers');
  const row = {
    assignment_id: cryptoRandomId(),
    name: body.name || '',
    email: normalizeEmail(body.email),
    vehicle: body.vehicle || '',
    client: body.client || '',
    hub: body.hub || '',
    shift_date: body.date || body.shiftDate || null,
    shift: body.shift || body.rawShift || '',
    status: body.status || 'Assigned',
    session_state: body.sessionState || 'Ready',
    created_by: user.email,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('driver_assignments').insert(row);
  if (error) throw error;
  return { assignment: normalizeDriverAssignment(row) };
}

async function updateDriverSession(body, user) {
  requirePermission(user, 'driver');
  const nextState = body.state || body.sessionState || 'Active session';
  const patch = {
    session_state: nextState,
    status: body.status || (nextState === 'Ended session' ? 'Completed' : 'Started'),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('driver_assignments')
    .update(patch)
    .eq('assignment_id', body.assignmentId || '')
    .select()
    .limit(1);
  if (error) throw error;
  return { assignment: normalizeDriverAssignment(data?.[0] || { ...body, ...patch }) };
}

async function getTasks(user) {
  requirePermission(user, 'tasks');
  const rows = await listRows('ops_tasks', 'created_at', false);
  return { tasks: scopeRows(rows || [], user).map(normalizeTask) };
}

async function markTaskDone(path, user) {
  requirePermission(user, 'tasks');
  const taskId = decodeURIComponent(path.split('/').at(-2) || '');
  const { data, error } = await supabase
    .from('ops_tasks')
    .update({
      status: 'Done',
      completed_by: user.email,
      completed_at: new Date().toISOString(),
    })
    .eq('task_id', taskId)
    .select()
    .limit(1);
  if (error) throw error;
  return { task: normalizeTask(data?.[0] || {}) };
}

async function getSettings() {
  const rows = await listRows('settings');
  const values = Object.fromEntries((rows || []).map((row) => [row.key, row.value]));
  return { settings: normalizeSettings(values) };
}

async function saveSettings(body, user) {
  requirePermission(user, 'alerts');
  const settings = normalizeSettings(body);
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value: String(value),
    updated_by: user.email,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
  return { settings };
}

async function getCarbonTrend(periodValue) {
  const period = ['week', 'month', 'year'].includes(periodValue) ? periodValue : 'week';
  const start = trendStartDate(period).toISOString();
  const { data, error } = await supabase
    .from('vehicle_snapshots')
    .select('*')
    .gte('scraped_at', start)
    .order('scraped_at', { ascending: true });
  if (error) throw error;
  const { settings } = await getSettings();
  return { period, unit: 'kgCO2e', points: buildCarbonTrend(data || [], period, settings) };
}

async function getAlertPreview(user) {
  requirePermission(user, 'alerts');
  const { settings } = await getSettings();
  const { data, error } = await supabase.from('vehicle_snapshots').select('*').order('scraped_at', { ascending: false }).limit(1000);
  if (error) throw error;
  return { alerts: buildMovementAlerts(data || [], settings), setupNeeded: false };
}

async function sendAlertsDryRun(user) {
  requirePermission(user, 'alerts');
  const preview = await getAlertPreview(user);
  return {
    ok: true,
    sent: 0,
    vehicles: preview.alerts.length,
    delivery: { mode: 'supabase-preview-only' },
    message: 'Supabase-only mode can preview alerts. Email sending needs a Supabase Edge Function later.',
  };
}

async function createDeploymentTasks(deployment, user) {
  const reason = deployment.previous_undeploy_at
    ? `${deployment.usage || 'Deployment'}; previous site undeploy ${deployment.previous_undeploy_at}; layover at ${deployment.layover_parking}`
    : `${deployment.usage || 'Deployment'}; layover at ${deployment.layover_parking}`;
  const base = {
    vehicle: deployment.vehicle,
    client: deployment.client,
    hub: deployment.hub,
    parking: deployment.parking,
    poc: deployment.poc,
    due: deployment.deploy_at || 'Deployment start time',
    reason,
    status: 'Pending',
  };
  const titles = [
    'Confirm deployment details with client POC',
    'Park vehicle at assigned parking',
    'Assign driver and confirm shift start',
    deployment.layover_parking && deployment.layover_parking !== deployment.parking ? `Confirm layover parking readiness (${deployment.layover_parking})` : '',
    deployment.previous_undeploy_at ? 'End previous deployment and log undeploy time' : '',
  ].filter(Boolean);
  const tasks = [];
  for (const title of titles) {
    // eslint-disable-next-line no-await-in-loop
    tasks.push(await createOpsTask({ ...base, title }, user));
  }
  return tasks;
}

async function createOpsTask(taskInput, user) {
  const row = {
    task_id: cryptoRandomId(),
    title: taskInput.title,
    vehicle: taskInput.vehicle,
    client: taskInput.client,
    hub: taskInput.hub,
    parking: taskInput.parking,
    poc: taskInput.poc,
    due: taskInput.due,
    reason: taskInput.reason,
    status: taskInput.status || 'Pending',
    created_by: user.email,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('ops_tasks').insert(row).select().single();
  if (error) throw error;
  return normalizeTask(data || row);
}

async function listRows(table, orderBy = '', ascending = true) {
  let request = supabase.from(table).select('*');
  if (orderBy) request = request.order(orderBy, { ascending });
  const { data, error } = await request;
  if (error) throw error;
  return data || [];
}

async function listTodaySnapshots() {
  const { data, error } = await supabase
    .from('vehicle_snapshots')
    .select('*')
    .gte('scraped_at', todayStartIsoForIndia())
    .order('scraped_at', { ascending: false })
    .limit(10000);
  if (error) throw error;
  return data || [];
}

function normalizeClient(row) {
  return {
    client: row.name || row.client || '',
    gstNumber: row.gst_number || row.gstNumber || '',
    clientPoc: row.poc || row.clientPoc || '',
    hubs: (row.hubs || []).filter((hub) => hub.enabled !== false).map((hub) => ({
      name: hub.name || '',
      gmpLink: hub.gmp_link || '',
      lat: toNumberOrUndefined(hub.lat),
      lng: toNumberOrUndefined(hub.lng),
    })),
    parkings: (row.parkings || []).filter((parking) => parking.enabled !== false).map((parking) => ({
      name: parking.name || '',
      gmpLink: parking.gmp_link || '',
      lat: toNumberOrUndefined(parking.lat),
      lng: toNumberOrUndefined(parking.lng),
    })),
  };
}

function normalizeVehicle(row, index = 0, latestSnapshot = null, settings = normalizeSettings()) {
  const raw = latestSnapshot?.raw_payload || row.metadata || {};
  const source = latestSnapshot || {};
  const lat = toNumberOrUndefined(firstValue(source.latitude, raw.lat, row.lat, row.latitude));
  const lng = toNumberOrUndefined(firstValue(source.longitude, raw.long, raw.lng, row.lng, row.longitude));
  const todayDistance = toNumber(firstValue(source.distance_today_km, raw['Dist._today'], row.today_distance, row.distance_today_km));
  const runningMinutes = numberOrNull(firstValue(source.today_running_minutes, raw['time today'], row.today_running_minutes));
  const runningTime = minutesLabel(runningMinutes) || row.running_time || '0h 0m';
  const avgSpeed = averageSpeedLabel(todayDistance, runningMinutes, firstValue(source.today_avg_speed_kmph, raw['average speed(calculated from distance and time)'], row.avg_speed));
  const lastStop = firstText(source.last_stop_location_text, raw['last stop'], row.last_stop, row.last_stop_location_text, coordinateLabel(lat, lng), 'No stop recorded today');
  const lastUpdated = firstText(source.scraped_at, row.last_updated, row.updated_at, row.created_at, '');
  const carbonSaved = carbonSavedVsCng(todayDistance, settings);
  const carbonRate = carbonRateVsCng(settings);
  const model = firstText(source.vehicle_model, raw['vehicle model/model'], row.model, row.source_system, 'Model pending');
  const sourceSystem = firstText(source.source, raw.source, row.source_system, 'Source pending');

  return {
    id: row.id || row.vehicle || `EV-${index + 1}`,
    model,
    sourceSystem,
    client: row.client || 'Unassigned client',
    hub: row.hub || 'Unassigned hub',
    parking: row.parking || 'Parking unavailable',
    status: normalizeStatus(firstValue(source.movement_status_raw, raw['current status of vehicle'], row.status)),
    battery: Number(firstValue(source.battery_percent, raw['battery%'], row.battery, row.battery_percent)) || 0,
    distance: Number(row.distance) || 0,
    todayDistance,
    runningTime,
    avgSpeed,
    temp: firstText(row.temp, raw.battery_temperature_c, 'Not recorded'),
    odometer: firstText(source.odometer_km, raw.odometer, row.odometer, 'Not recorded'),
    energy: '',
    eta: row.eta || 'Unavailable',
    etaDate: row.eta_date || '',
    lastUpdated,
    driverState: row.driver_state || 'none',
    driver: row.driver || 'No driver confirmed yet',
    driverMeta: row.driver_meta || 'Driver session not connected',
    route: lastStop,
    location: firstText(row.location, row.location_text, lastStop, coordinateLabel(lat, lng), 'Location pending'),
    lastStop,
    carbon: `${carbonSaved.toFixed(1)} kgCO2e`,
    confidence: `Estimated from distance x ${carbonRate.toFixed(3)} kgCO2e/km vs CNG`,
    trips: [{
      title: 'Latest stop',
      location: lastStop,
      distanceTodayKm: todayDistance,
      runningTime,
      scrapedAt: lastUpdated,
    }],
    lat,
    lng,
    x: 34 + (index % 8) * 6,
    y: 38 + (index % 5) * 8,
  };
}

function normalizeDeployment(row) {
  return {
    deploymentId: row.deployment_id || '',
    vehicle: row.vehicle || '',
    client: row.client || '',
    hub: row.hub || '',
    hubGmpLink: row.hub_gmp_link || '',
    hubLat: toNumberOrUndefined(row.hub_lat),
    hubLng: toNumberOrUndefined(row.hub_lng),
    parking: row.parking || '',
    parkingGmpLink: row.parking_gmp_link || '',
    parkingLat: toNumberOrUndefined(row.parking_lat),
    parkingLng: toNumberOrUndefined(row.parking_lng),
    deployAt: row.deploy_at || '',
    status: row.status || 'Active',
  };
}

function normalizeDriverAssignment(row) {
  return {
    assignmentId: row.assignment_id || '',
    name: row.name || '',
    email: row.email || '',
    vehicle: row.vehicle || '',
    client: row.client || '',
    hub: row.hub || '',
    date: row.shift_date || '',
    shift: row.shift_date ? `${row.shift_date} - ${row.shift || ''}`.trim() : row.shift || '',
    rawShift: row.shift || '',
    status: row.status || 'Assigned',
    sessionState: row.session_state || 'Ready',
    createdAt: row.created_at || '',
  };
}

function normalizeDriver(row) {
  return {
    driverId: row.driver_id || '',
    name: row.name || '',
    phone: row.phone || '',
    licenseNumber: row.license_number || '',
    dob: row.dob || '',
    email: normalizeEmail(row.email),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function normalizeParkingSite(row) {
  return {
    parkingId: row.parking_id || '',
    name: row.name || '',
    location: row.location || '',
    gmpLink: row.gmp_link || '',
    lat: toNumberOrUndefined(row.lat),
    lng: toNumberOrUndefined(row.lng),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function normalizeTask(row) {
  return {
    id: row.task_id || row.id || '',
    title: row.title || '',
    vehicle: row.vehicle || '',
    client: row.client || '',
    hub: row.hub || '',
    parking: row.parking || '',
    poc: row.poc || '',
    due: row.due || '',
    reason: row.reason || '',
    status: row.status || 'Pending',
  };
}

function mergeVehicleOpsData(vehicle, deploymentRow, assignmentRow, index) {
  const deployment = deploymentRow ? normalizeDeployment(deploymentRow) : null;
  const assignment = assignmentRow ? normalizeDriverAssignment(assignmentRow) : null;
  const next = { ...vehicle, x: vehicle.x ?? 34 + (index % 8) * 6, y: vehicle.y ?? 38 + (index % 5) * 8 };
  if (deployment) {
    Object.assign(next, {
      client: deployment.client || next.client,
      hub: deployment.hub || next.hub,
      hubGmpLink: deployment.hubGmpLink,
      hubLat: deployment.hubLat,
      hubLng: deployment.hubLng,
      parking: deployment.parking || next.parking,
      parkingGmpLink: deployment.parkingGmpLink,
      parkingLat: deployment.parkingLat,
      parkingLng: deployment.parkingLng,
      route: deployment.hub ? `${deployment.hub} deployment route` : next.route,
      lastStop: deployment.parking || next.lastStop,
      locationState: locationStateFor(next, deployment),
    });
  }
  if (assignment) {
    Object.assign(next, {
      driverState: assignment.sessionState === 'Active session' ? 'active' : 'assigned',
      driver: assignment.name || next.driver,
      driverMeta: `${assignment.status} - ${assignment.shift}`,
    });
  }
  return next;
}

function parseLocationLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => {
      const [name = '', gmpLink = ''] = line.trim().split('|').map((part) => part.trim());
      const coords = extractMapCoords(gmpLink);
      return { name, gmpLink, lat: coords?.lat ?? null, lng: coords?.lng ?? null };
    })
    .filter((item) => item.name || item.gmpLink);
}

function buildMovementAlerts(records, settings) {
  const targetDate = previousDateKey();
  const latestByVehicle = latestByKey(records.filter((row) => dateKey(row.scraped_at || row.last_updated || row.updated_at) === targetDate), 'vehicle_id', 'scraped_at');
  return [...latestByVehicle.values()].map((record) => {
    const distance = Number(record.distance_today_km ?? record.today_distance ?? 0);
    const runningMinutes = Number(record.today_running_minutes ?? 0);
    const reasons = [];
    if (distance < settings.minDistance) reasons.push(`distance ${distance} km < ${settings.minDistance} km`);
    if (runningMinutes < settings.minRunTime) reasons.push(`running ${runningMinutes} min < ${settings.minRunTime} min`);
    return {
      vehicle: record.vehicle_id || record.vehicle_number || '',
      sourceSystem: record.source || 'Unknown',
      date: targetDate,
      distanceTodayKm: distance,
      runningMinutes,
      batteryPercent: Number(record.battery_percent ?? 0),
      status: normalizeStatus(record.movement_status_raw),
      location: record.last_stop_location_text || coordinateLabel(record.latitude, record.longitude),
      lastUpdated: record.scraped_at || '',
      reasons,
    };
  }).filter((alert) => alert.vehicle && alert.reasons.length);
}

function buildCarbonTrend(records, period, settings) {
  const bucketMap = new Map(trendBuckets(period).map((bucket) => [bucket.key, { ...bucket, value: 0 }]));
  const latestByBucketVehicle = new Map();
  records.forEach((record) => {
    const date = new Date(record.scraped_at || record.last_updated || record.created_at || 0);
    if (Number.isNaN(date.getTime())) return;
    const key = period === 'year' ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10);
    const bucket = bucketMap.get(key);
    if (!bucket) return;
    const vehicle = vehicleKey(record.vehicle_number || record.vehicle_id || record.id);
    if (!vehicle) return;
    const mapKey = `${key}:${vehicle}`;
    const previous = latestByBucketVehicle.get(mapKey);
    const previousTime = previous ? new Date(previous.scraped_at || previous.created_at || 0).getTime() : -1;
    if (date.getTime() < previousTime) return;
    latestByBucketVehicle.set(mapKey, record);
  });
  latestByBucketVehicle.forEach((record, mapKey) => {
    const key = mapKey.split(':')[0];
    const bucket = bucketMap.get(key);
    if (!bucket) return;
    const distance = Number(record.distance_today_km ?? record.today_distance ?? 0);
    const carbon = carbonSavedVsCng(distance, settings);
    if (Number.isFinite(carbon)) bucket.value += carbon;
  });
  return [...bucketMap.values()].map((bucket) => ({ label: bucket.label, value: Number(bucket.value.toFixed(2)) }));
}

function normalizeSettings(input = {}) {
  const defaults = {
    goodCharge: 70,
    minDistance: 1,
    minRunTime: 10,
    electricityFactor: 0.72,
    cngFactor: 2.75,
    cngConsumption: 0.18,
    evEnergy: 0.22,
  };
  return {
    goodCharge: boundedNumber(input.goodCharge, defaults.goodCharge, 1, 100),
    minDistance: boundedNumber(input.minDistance, defaults.minDistance, 0, 100000),
    minRunTime: boundedNumber(input.minRunTime, defaults.minRunTime, 0, 1440),
    electricityFactor: boundedNumber(input.electricityFactor, defaults.electricityFactor, 0, 100),
    cngFactor: boundedNumber(input.cngFactor, defaults.cngFactor, 0, 100),
    cngConsumption: boundedNumber(input.cngConsumption, defaults.cngConsumption, 0, 10),
    evEnergy: boundedNumber(input.evEnergy, defaults.evEnergy, 0, 10),
  };
}

function scopeRows(rows, user) {
  if (canAccess(user, 'all') || !user.client) return rows;
  const client = normalizeText(user.client);
  return rows.filter((row) => normalizeText(row.client || row.name) === client || normalizeEmail(row.email) === user.email);
}

function requirePermission(user, permission) {
  if (!canAccess(user, permission)) throw new Error('You do not have permission for this action');
}

function canAccess(user, permission) {
  if (!user) return false;
  const permissions = user.permissions || [];
  if (permissions.includes('all')) return true;
  if (Array.isArray(permission)) return permission.some((item) => canAccess(user, item));
  return permissions.includes(permission);
}

function permissionsForRole(role) {
  if (role === 'admin') return ['all'];
  if (role === 'supervisor' || role === 'ops') return ['fleet', 'deployments', 'drivers', 'tasks', 'reports', 'alerts'];
  if (role === 'driver') return ['driver'];
  if (role === 'viewer') return ['fleet', 'reports'];
  return ['fleet'];
}

function latestByKey(rows, key, timeKey) {
  const latest = new Map();
  rows.forEach((row) => {
    const id = vehicleKey(row[key] || row.vehicle || row.id);
    if (!id) return;
    const currentTime = new Date(row[timeKey] || row.created_at || 0).getTime() || 0;
    const previous = latest.get(id);
    const previousTime = previous ? new Date(previous[timeKey] || previous.created_at || 0).getTime() || 0 : -1;
    if (currentTime >= previousTime) latest.set(id, row);
  });
  return latest;
}

function latestSnapshotByVehicle(rows) {
  const latest = new Map();
  rows.forEach((row) => {
    const id = vehicleKey(row.vehicle_number || row.vehicle || row.vehicle_id || row.id);
    if (!id) return;
    const currentTime = new Date(row.scraped_at || row.created_at || 0).getTime() || 0;
    const previous = latest.get(id);
    const previousTime = previous ? new Date(previous.scraped_at || previous.created_at || 0).getTime() || 0 : -1;
    if (currentTime >= previousTime) latest.set(id, row);
  });
  return latest;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== 'Unavailable');
}

function firstText(...values) {
  const value = firstValue(...values);
  return value === undefined ? '' : String(value).trim();
}

function locationStateFor(vehicle, deployment) {
  if (!Number.isFinite(vehicle.lat) || !Number.isFinite(vehicle.lng)) return 'Location unavailable';
  const vehicleCoords = { lat: vehicle.lat, lng: vehicle.lng };
  const parkingDistance = distanceMeters(vehicleCoords, { lat: deployment.parkingLat, lng: deployment.parkingLng });
  if (parkingDistance <= 100) return 'Inside parking';
  const hubDistance = distanceMeters(vehicleCoords, { lat: deployment.hubLat, lng: deployment.hubLng });
  if (hubDistance <= 100) return 'Inside hub';
  return 'Outside hub/parking';
}

function distanceMeters(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return Number.POSITIVE_INFINITY;
  const earthRadiusMeters = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

function extractMapCoords(value) {
  const text = String(value || '');
  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
  const queryMatch = text.match(/[?&](?:q|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (queryMatch) return { lat: Number(queryMatch[1]), lng: Number(queryMatch[2]) };
  return null;
}

function trendStartDate(period) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (period === 'year') {
    date.setMonth(date.getMonth() - 11, 1);
    return date;
  }
  date.setDate(date.getDate() - (period === 'month' ? 29 : 6));
  return date;
}

function trendBuckets(period) {
  const start = trendStartDate(period);
  const formatter = period === 'year'
    ? new Intl.DateTimeFormat('en', { month: 'short' })
    : new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short' });
  const count = period === 'year' ? 12 : period === 'month' ? 30 : 7;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    if (period === 'year') date.setMonth(start.getMonth() + index);
    else date.setDate(start.getDate() + index);
    return {
      key: period === 'year' ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10),
      label: formatter.format(date),
    };
  });
}

function carbonRateVsCng(settings) {
  const cngEmissionsPerKm = settings.cngConsumption * settings.cngFactor;
  const evEmissionsPerKm = settings.evEnergy * settings.electricityFactor;
  return Math.max(0, cngEmissionsPerKm - evEmissionsPerKm);
}

function carbonSavedVsCng(distanceKm, settings) {
  if (!distanceKm) return 0;
  return Math.max(0, distanceKm * carbonRateVsCng(settings));
}

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status.includes('run') || status.includes('moving')) return 'Running';
  if (status.includes('charg')) return 'Charging';
  if (status.includes('offline') || status.includes('stale')) return 'Offline';
  return 'Idle';
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toNumberOrUndefined(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function minutesLabel(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return '';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function averageSpeedLabel(distanceKm, runningMinutes, fallback = '') {
  const distance = Number(distanceKm);
  const minutes = Number(runningMinutes);
  if (Number.isFinite(distance) && Number.isFinite(minutes) && minutes > 0) {
    return `${(distance / (minutes / 60)).toFixed(1)} km/h`;
  }
  const fallbackNumber = Number(fallback);
  if (Number.isFinite(fallbackNumber)) return `${fallbackNumber.toFixed(1)} km/h`;
  const fallbackText = String(fallback || '').trim();
  if (fallbackText && !/unavailable/i.test(fallbackText)) return fallbackText;
  return distance ? 'Needs review' : '0 km/h';
}

function todayStartIsoForIndia() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00+05:30`).toISOString();
}

function previousDateKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return dateKey(date);
}

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function coordinateLabel(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : '';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeLicense(value) {
  return String(value || '').trim().toLowerCase();
}

async function findDuplicateDriverMessage(candidate, excludeDriverId = '') {
  const phone = normalizePhone(candidate.phone);
  const email = normalizeEmail(candidate.email);
  const license = normalizeLicense(candidate.license_number || candidate.licenseNumber);
  if (!phone && !email && !license) return '';
  const rows = await listRows('drivers', 'created_at', false);
  const excludeId = String(excludeDriverId || '').trim();
  const duplicate = (rows || []).find((row) => {
    const driverId = String(row.driver_id || row.driverId || '').trim();
    if (excludeId && driverId === excludeId) return false;
    return (
      (phone && normalizePhone(row.phone) === phone)
      || (email && normalizeEmail(row.email) === email)
      || (license && normalizeLicense(row.license_number || row.licenseNumber) === license)
    );
  });
  if (!duplicate) return '';
  if (phone && normalizePhone(duplicate.phone) === phone) return 'A driver with this contact number already exists.';
  if (email && normalizeEmail(duplicate.email) === email) return 'A driver with this email already exists.';
  if (license && normalizeLicense(duplicate.license_number || duplicate.licenseNumber) === license) return 'A driver with this license number already exists.';
  return 'This driver already exists.';
}

function driverPersistenceErrorMessage(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  if (text.includes('phone') || text.includes('idx_drivers_phone')) return 'A driver with this contact number already exists.';
  if (text.includes('email') || text.includes('idx_drivers_email')) return 'A driver with this email already exists.';
  if (text.includes('license') || text.includes('idx_drivers_license')) return 'A driver with this license number already exists.';
  return error?.message || 'Unable to save driver.';
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function vehicleKey(value) {
  return String(value || '').trim().toUpperCase();
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
