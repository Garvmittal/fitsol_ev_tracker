import 'dotenv/config';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import express from 'express';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import supabaseModule from './server/supabaseClient.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const spreadsheetId = process.env.GOOGLE_SHEET_ID || '1_A58jO3bLmeZor0kwjNFaypqRGpW9KG0EOirrU9rbjA';
const sheetGid = Number(process.env.GOOGLE_SHEET_GID || 148386816);
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service_account.json';
const alertRecipientsSheetName = process.env.ALERT_RECIPIENTS_SHEET_NAME || 'Alert Recipients';
const authUsersSheetName = process.env.AUTH_USERS_SHEET_NAME || 'Users';
const clientHubsSheetName = process.env.CLIENT_HUBS_SHEET_NAME || 'Client Hubs';
const clientParkingsSheetName = process.env.CLIENT_PARKINGS_SHEET_NAME || 'Client Parkings';
const deploymentsSheetName = process.env.DEPLOYMENTS_SHEET_NAME || 'Deployments';
const driverAssignmentsSheetName = process.env.DRIVER_ASSIGNMENTS_SHEET_NAME || 'Driver Assignments';
const driversSheetName = process.env.DRIVERS_SHEET_NAME || 'Drivers';
const opsTasksSheetName = process.env.OPS_TASKS_SHEET_NAME || 'Ops Tasks';
const dashboardSettingsSheetName = process.env.DASHBOARD_SETTINGS_SHEET_NAME || 'Dashboard Settings';
const parkingSitesSheetName = process.env.PARKING_SITES_SHEET_NAME || 'Parking Sites';
const defaultAdminEmail = normalizeEmail(process.env.DEFAULT_ADMIN_EMAIL);
const defaultAdminName = process.env.DEFAULT_ADMIN_NAME || 'Admin User';
const authRequired = process.env.AUTH_REQUIRED === 'true';
const otpDevMode = process.env.OTP_DEV_MODE === 'true';
const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const sessionExpiryHours = Number(process.env.SESSION_EXPIRY_HOURS || 12);
const alertMinRunningMinutes = Number(process.env.ALERT_MIN_RUNNING_MINUTES || 60);
const alertMinDistanceKm = Number(process.env.ALERT_MIN_DISTANCE_KM || 1);
const cngConsumptionKgPerKm = Number(process.env.CNG_CONSUMPTION_KG_PER_KM || 0.18);
const evEnergyKwhPerKm = Number(process.env.EV_ENERGY_KWH_PER_KM || 0.22);
const otpStore = new Map();
const sessions = new Map();
const useSupabase = process.env.USE_SUPABASE === 'true';
const apiCacheSeconds = Number(process.env.API_CACHE_SECONDS || 30);
const sheetRecordsCache = new Map();

app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/config', (_request, response) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const googleMapsMapId = process.env.GOOGLE_MAPS_MAP_ID || process.env.VITE_GOOGLE_MAP_ID || '';
  response.json({
    googleMaps: {
      enabled: Boolean(googleMapsApiKey),
      apiKey: googleMapsApiKey,
      mapId: googleMapsMapId,
      missing: {
        apiKey: !googleMapsApiKey,
        mapId: !googleMapsMapId,
      },
    },
  });
});

const reverseGeocodeCache = new Map();
const reverseGeocodeTtlMs = 24 * 60 * 60 * 1000;

app.get('/api/reverse-geocode', (request, response) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  const lat = Number(request.query.lat);
  const lng = Number(request.query.lng);
  if (!apiKey) return response.status(400).json({ error: 'GOOGLE_MAPS_API_KEY is not configured' });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return response.status(400).json({ error: 'Valid lat and lng are required' });

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = reverseGeocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return response.json({ ok: true, place: cached.place });

  Promise.resolve()
    .then(async () => {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('key', apiKey);
      const res = await fetch(url.toString());
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error_message || payload.error || 'Google geocode failed');
      if (payload.status && payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
        throw new Error(payload.error_message || `Google geocode returned ${payload.status}`);
      }
      const best = payload.results?.[0]?.formatted_address || '';
      const place = best ? simplifyPlaceLabel(best) : '';
      reverseGeocodeCache.set(key, { place, expiresAt: Date.now() + reverseGeocodeTtlMs });
      return place;
    })
    .then((place) => response.json({ ok: true, place }))
    .catch((error) => response.status(500).json({ error: 'Unable to reverse geocode', message: error.message }));
});

app.get('/api/auth/me', async (request, response) => {
  const session = getSession(request);
  if (session) return response.json({ user: session.user, authRequired });
  if (!authRequired) return response.json({ user: guestUser(), authRequired });
  return response.status(401).json({ error: 'Not signed in' });
});

app.post('/api/auth/request-otp', async (request, response) => {
  try {
    const email = normalizeEmail(request.body?.email);
    if (!email) return response.status(400).json({ error: 'Email is required' });
    const user = await findUserByEmail(email);
    if (!user) return response.status(403).json({ error: 'This email is not allowed for dashboard access' });
    const otp = String(crypto.randomInt(100000, 999999));
    otpStore.set(email, {
      otpHash: hashOtp(otp),
      expiresAt: Date.now() + otpExpiryMinutes * 60 * 1000,
      user,
    });
    const mail = await sendMail({
      to: email,
      subject: 'Your Kyoto EV Fleet sign-in OTP',
      text: `Hi ${user.name},\n\nYour Kyoto EV Fleet OTP is ${otp}. It expires in ${otpExpiryMinutes} minutes.\n\nIf you did not request this, ignore this email.`,
    });
    response.json({ ok: true, delivery: mail.mode, devOtp: otpDevMode && mail.mode === 'dev' ? otp : undefined });
  } catch (error) {
    response.status(500).json({ error: 'Unable to send OTP', message: error.message });
  }
});

app.post('/api/auth/verify-otp', (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const otp = String(request.body?.otp || '').trim();
  const pending = otpStore.get(email);
  if (!pending || pending.expiresAt < Date.now() || pending.otpHash !== hashOtp(otp)) {
    return response.status(401).json({ error: 'Invalid or expired OTP' });
  }
  otpStore.delete(email);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    user: pending.user,
    expiresAt: Date.now() + sessionExpiryHours * 60 * 60 * 1000,
  });
  response.setHeader('Set-Cookie', sessionCookie(token, sessionExpiryHours * 60 * 60));
  response.json({ user: pending.user });
});

app.post('/api/auth/logout', (_request, response) => {
  response.setHeader('Set-Cookie', sessionCookie('', 0));
  response.json({ ok: true });
});

app.get('/api/fleet', requirePermission('fleet'), async (request, response) => {
  try {
    const sheets = await getSheetsClient();
    const { sheetTitle, records: rawRecords } = await getFleetData(sheets);
    const assignments = await getLatestAssignmentsByVehicle(sheets);
    const deployments = await getLatestDeploymentsByVehicle(sheets);
    const settings = await getDashboardSettings(sheets);
    const vehicles = normalizeFleetRecords(scopeRows(rawRecords, request.user), settings)
      .map((vehicle, index) => mergeVehicleOpsData(vehicle, deployments.get(vehicle.id), assignments.get(vehicle.id), index));
    response.json({ sheetTitle, vehicles, updatedAt: new Date().toISOString() });
  } catch (error) {
    response.status(500).json({
      error: 'Unable to load fleet sheet',
      message: error.message,
      hint: 'Share the spreadsheet with the service account client_email and verify GOOGLE_SHEET_ID / GOOGLE_SHEET_GID.',
    });
  }
});

app.get('/api/client-hubs', requirePermission('fleet'), async (request, response) => {
  try {
    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, clientHubsSheetName, clientHubHeaders());
    await ensureSheetWithHeaders(sheets, clientParkingsSheetName, clientParkingHeaders());
    const hubRows = scopeRows(await getSheetRecords(sheets, clientHubsSheetName), request.user);
    const parkingRows = scopeRows(await getSheetRecords(sheets, clientParkingsSheetName), request.user);
    response.json({ clients: groupClientHubs(hubRows, parkingRows) });
  } catch (error) {
    response.status(500).json({ error: 'Unable to load client hubs', message: error.message });
  }
});

app.post('/api/client-hubs', requirePermission('deployments'), async (request, response) => {
  try {
    const client = String(request.body?.client || '').trim();
    const gstNumber = String(request.body?.gstNumber || request.body?.gst || '').trim();
    const clientPoc = String(request.body?.clientPoc || request.body?.poc || '').trim();
    const hubs = parseHubInput(request.body?.hubs);
    const parkings = parseHubInput(request.body?.parkings);
    if (!client) return response.status(400).json({ error: 'Client name is required' });
    if (!gstNumber) return response.status(400).json({ error: 'GST number is required' });
    if (!clientPoc) return response.status(400).json({ error: 'Client POC is required' });
    if (!hubs.length) return response.status(400).json({ error: 'At least one hub is required' });
    if (hubs.some((hub) => !hub.name || !hub.gmpLink)) return response.status(400).json({ error: 'Every hub needs a name and Google Maps link' });
    if (parkings.some((parking) => !parking.name || !parking.gmpLink)) return response.status(400).json({ error: 'Every parking point needs a name and Google Maps link' });
    if (hubs.some((hub) => !isValidGoogleMapsLink(hub.gmpLink))) return response.status(400).json({ error: 'Use valid Google Maps links with coordinates for each hub' });
    if (parkings.some((parking) => !isValidGoogleMapsLink(parking.gmpLink))) return response.status(400).json({ error: 'Use valid Google Maps links with coordinates for each parking point' });
    if (parkings.some((parking) => normalizeParkingSpaces(parking.spaces) === null)) return response.status(400).json({ error: 'Parking spaces must be zero or more' });
    const sheets = await getSheetsClient();
    const hubHeaders = clientHubHeaders();
    const parkingHeaders = clientParkingHeaders();
    await ensureSheetWithHeaders(sheets, clientHubsSheetName, hubHeaders);
    await ensureSheetWithHeaders(sheets, clientParkingsSheetName, parkingHeaders);
    const existingRows = await getSheetRecords(sheets, clientHubsSheetName);
    const existingKeys = new Set(existingRows.map((row) => `${String(row.client || row.Client || '').trim().toLowerCase()}::${String(row.hub || row.Hub || '').trim().toLowerCase()}`));
    const existingParkingRows = await getSheetRecords(sheets, clientParkingsSheetName);
    const existingParkingKeys = new Set(existingParkingRows.map((row) => `${String(row.client || row.Client || '').trim().toLowerCase()}::${String(row.parking || row.Parking || '').trim().toLowerCase()}`));
    const createdAt = new Date().toISOString();
    const hubRows = hubs.length
      ? hubs
          .filter((hub) => !existingKeys.has(`${client.toLowerCase()}::${hub.name.toLowerCase()}`))
          .map((hub) => {
            const coords = extractMapCoords(hub.gmpLink) || {};
            return [client, hub.name, hub.gmpLink, coords.lat || '', coords.lng || '', 'TRUE', gstNumber, clientPoc, createdAt];
          })
      : existingKeys.has(`${client.toLowerCase()}::`)
        ? []
        : [[client, '', '', '', '', 'TRUE', gstNumber, clientPoc, createdAt]];
    const parkingRows = parkings
      .filter((parking) => !existingParkingKeys.has(`${client.toLowerCase()}::${parking.name.toLowerCase()}`))
      .map((parking) => {
        const coords = extractMapCoords(parking.gmpLink) || {};
        const spaces = normalizeParkingSpaces(parking.spaces) ?? 0;
        return [client, parking.name, parking.gmpLink, coords.lat || '', coords.lng || '', spaces, spaces, 'TRUE', createdAt];
      });
    if (useSupabase) {
      await upsertSupabaseClientLocations({
        client,
        gstNumber,
        clientPoc,
        hubs,
        parkings,
        existingKeys,
        existingParkingKeys,
        createdAt,
      });
      const nextHubRows = scopeRows(await getSheetRecords(sheets, clientHubsSheetName), request.user);
      const nextParkingRows = scopeRows(await getSheetRecords(sheets, clientParkingsSheetName), request.user);
      return response.json({ ok: true, clients: groupClientHubs(nextHubRows, nextParkingRows) });
    }
    if (hubRows.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${clientHubsSheetName.replace(/'/g, "''")}'!A:${columnLetter(hubHeaders.length)}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: hubRows },
      });
    }
    if (parkingRows.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${clientParkingsSheetName.replace(/'/g, "''")}'!A:${columnLetter(parkingHeaders.length)}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: parkingRows },
      });
    }
    const nextHubRows = scopeRows(await getSheetRecords(sheets, clientHubsSheetName), request.user);
    const nextParkingRows = scopeRows(await getSheetRecords(sheets, clientParkingsSheetName), request.user);
    response.json({ ok: true, clients: groupClientHubs(nextHubRows, nextParkingRows) });
  } catch (error) {
    response.status(500).json({ error: 'Unable to save client hubs', message: error.message });
  }
});

app.get('/api/deployments', requirePermission('deployments'), async (request, response) => {
  try {
    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, deploymentsSheetName, deploymentHeaders());
    const rows = scopeRows(await getSheetRecords(sheets, deploymentsSheetName), request.user);
    response.json({ deployments: rows.map(normalizeDeploymentRow) });
  } catch (error) {
    response.status(500).json({ error: 'Unable to load deployments', message: error.message });
  }
});

app.post('/api/deployments', requirePermission('deployments'), async (request, response) => {
  try {
    const vehicle = String(request.body?.vehicle || '').trim().toUpperCase();
    const client = String(request.body?.client || '').trim();
    const hub = String(request.body?.hub || '').trim();
    const parking = String(request.body?.parking || '').trim();
    const hubGmpLink = String(request.body?.hubGmpLink || '').trim();
    const parkingGmpLink = String(request.body?.parkingGmpLink || '').trim();
    const previousUndeployAt = String(request.body?.previousUndeployAt || '').trim();
    const deployAt = String(request.body?.deployAt || '').trim();
    const layoverParking = String(request.body?.layoverParking || '').trim();
    const layoverParkingGmpLink = String(request.body?.layoverParkingGmpLink || '').trim();
    const usage = String(request.body?.usage || '').trim();
    const poc = String(request.body?.poc || '').trim();
    const hubCoords = coordsFromBody(request.body, 'hub') || extractMapCoords(hubGmpLink);
    const parkingCoords = coordsFromBody(request.body, 'parking') || extractMapCoords(parkingGmpLink);
    const layoverCoords = coordsFromBody(request.body, 'layoverParking') || extractMapCoords(layoverParkingGmpLink);

    if (!vehicle || !client || !hub || !parking || !hubCoords || !parkingCoords || !deployAt || !layoverParking || !layoverCoords) {
      return response.status(400).json({ error: 'Vehicle, client hub, parking, deployment date/time, and layover parking coordinates are required' });
    }
    if (!canAccessClient(request.user, client)) return response.status(403).json({ error: 'You cannot deploy vehicles for this client' });

    const sheets = await getSheetsClient();
    const fleetVehicles = normalizeFleetRecords(scopeRows(await getFleetRecords(sheets), request.user));
    const sourceVehicle = fleetVehicles.find((item) => item.id === vehicle);
    if (!sourceVehicle) return response.status(404).json({ error: 'Choose a vehicle from the live Sheet fleet' });

    await ensureSheetWithHeaders(sheets, deploymentsSheetName, deploymentHeaders());
    const activeDeployments = await getLatestDeploymentsByVehicle(sheets);
    const activeDeployment = activeDeployments.get(vehicle);
    if (sourceVehicle.status !== 'Offline' && !activeDeployment) {
      return response.status(400).json({ error: 'Vehicle must be offline or already deployed before scheduling a new deployment' });
    }
    const deployment = {
      deployment_id: crypto.randomUUID(),
      vehicle,
      client,
      hub,
      hub_gmp_link: hubGmpLink,
      hub_lat: hubCoords.lat,
      hub_lng: hubCoords.lng,
      parking,
      parking_gmp_link: parkingGmpLink,
      parking_lat: parkingCoords.lat,
      parking_lng: parkingCoords.lng,
      previous_undeploy_at: previousUndeployAt,
      deploy_at: deployAt,
      layover_parking: layoverParking,
      layover_parking_gmp_link: layoverParkingGmpLink,
      layover_parking_lat: layoverCoords.lat,
      layover_parking_lng: layoverCoords.lng,
      usage,
      poc,
      status: deployAt && new Date(deployAt).getTime() > Date.now() ? 'Scheduled' : 'Active',
      created_by: request.user.email || request.user.name,
      created_at: new Date().toISOString(),
    };
    await appendRecord(sheets, deploymentsSheetName, deploymentHeaders(), deployment);
    const tasks = await createDeploymentTasks(sheets, {
      vehicle,
      client,
      hub,
      parking,
      layoverParking,
      previousUndeployAt,
      deployAt,
      usage,
      poc,
      createdBy: request.user.email || request.user.name,
    });
    response.json({ ok: true, deployment: normalizeDeploymentRow(deployment), tasks });
  } catch (error) {
    response.status(500).json({ error: 'Unable to save deployment', message: error.message });
  }
});

app.post('/api/deployments/remove', requirePermission('deployments'), async (request, response) => {
  try {
    const vehicle = String(request.body?.vehicle || '').trim().toUpperCase();
    const reason = String(request.body?.reason || '').trim();
    if (!vehicle) return response.status(400).json({ error: 'Choose a deployed vehicle to remove' });

    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, deploymentsSheetName, deploymentHeaders());
    const rows = scopeRows(await getSheetRecords(sheets, deploymentsSheetName), request.user);
    const activeDeployment = latestByKey(
      rows.filter((row) => String(row.vehicle || '').trim().toUpperCase() === vehicle && normalizeBoolean(row.status || 'Active')),
      'vehicle',
      'created_at',
    ).get(vehicle);

    if (!activeDeployment?.deployment_id) return response.status(404).json({ error: 'No active client deployment found for this vehicle' });
    if (!canAccessClient(request.user, activeDeployment.client)) return response.status(403).json({ error: 'You cannot remove vehicles for this client' });

    const removedAt = new Date().toISOString();
    const updated = await updateSheetRowById(
      sheets,
      deploymentsSheetName,
      'deployment_id',
      activeDeployment.deployment_id,
      {
        status: 'Removed',
        removed_by: request.user.email || request.user.name,
        removed_at: removedAt,
        remove_reason: reason,
      },
      (row) => canAccessClient(request.user, row.client),
    );

    response.json({ ok: true, deployment: normalizeDeploymentRow(updated), removedAt });
  } catch (error) {
    response.status(500).json({ error: 'Unable to remove deployment', message: error.message });
  }
});

app.get('/api/driver-assignments', requirePermission(['drivers', 'driver']), async (request, response) => {
  try {
    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, driverAssignmentsSheetName, driverAssignmentHeaders());
    const rows = await getSheetRecords(sheets, driverAssignmentsSheetName);
    const scoped = request.user.permissions?.includes('driver')
      ? rows.filter((row) => normalizeEmail(row.email || row.Email) === normalizeEmail(request.user.email))
      : scopeRows(rows, request.user);
    response.json({ assignments: scoped.map(normalizeDriverAssignmentRow).reverse() });
  } catch (error) {
    response.status(500).json({ error: 'Unable to load driver assignments', message: error.message });
  }
});

app.post('/api/driver-assignments', requirePermission('drivers'), async (request, response) => {
  try {
    const assignment = {
      assignment_id: crypto.randomUUID(),
      name: String(request.body?.name || '').trim(),
      email: normalizeEmail(request.body?.email),
      vehicle: String(request.body?.vehicle || '').trim().toUpperCase(),
      client: String(request.body?.client || '').trim(),
      hub: String(request.body?.hub || '').trim(),
      shift_date: String(request.body?.date || '').trim(),
      shift: String(request.body?.shift || '').trim(),
      status: 'Assigned',
      session_state: 'Ready',
      created_by: request.user.email || request.user.name,
      created_at: new Date().toISOString(),
    };
    if (!assignment.name || !assignment.email || !assignment.vehicle || !assignment.shift_date || !assignment.shift) {
      return response.status(400).json({ error: 'Driver, email, vehicle, date, and shift are required' });
    }
    if (assignment.client && !canAccessClient(request.user, assignment.client)) {
      return response.status(403).json({ error: 'You cannot assign drivers for this client' });
    }
    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, driverAssignmentsSheetName, driverAssignmentHeaders());
    await appendRecord(sheets, driverAssignmentsSheetName, driverAssignmentHeaders(), assignment);
    response.json({ ok: true, assignment: normalizeDriverAssignmentRow(assignment) });
  } catch (error) {
    response.status(500).json({ error: 'Unable to save driver assignment', message: error.message });
  }
});

app.get('/api/drivers', requirePermission('drivers'), async (request, response) => {
  try {
    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, driversSheetName, driverHeaders());
    const rows = await getSheetRecords(sheets, driversSheetName);
    response.json({ drivers: rows.map(normalizeDriverRow).reverse() });
  } catch (error) {
    response.status(500).json({ error: 'Unable to load drivers', message: error.message });
  }
});

app.post('/api/drivers', requirePermission('drivers'), async (request, response) => {
  try {
    const driver = {
      driver_id: crypto.randomUUID(),
      name: String(request.body?.name || '').trim(),
      phone: String(request.body?.phone || '').trim(),
      license_number: String(request.body?.licenseNumber || '').trim(),
      dob: String(request.body?.dob || '').trim(),
      email: normalizeEmail(request.body?.email),
      created_by: request.user.email || request.user.name,
      created_at: new Date().toISOString(),
      updated_at: '',
    };
    if (!driver.name || !driver.phone || !driver.license_number || !driver.dob || !driver.email) {
      return response.status(400).json({ error: 'Name, phone, license number, DOB, and email are required' });
    }

    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, driversSheetName, driverHeaders());
    await appendRecord(sheets, driversSheetName, driverHeaders(), driver);
    const rows = await getSheetRecords(sheets, driversSheetName);
    response.json({ ok: true, drivers: rows.map(normalizeDriverRow).reverse() });
  } catch (error) {
    response.status(500).json({ error: 'Unable to save driver', message: error.message });
  }
});

app.patch('/api/drivers/:driverId', requirePermission('drivers'), async (request, response) => {
  try {
    const driverId = String(request.params.driverId || '').trim();
    const phone = String(request.body?.phone || '').trim();
    if (!driverId) return response.status(400).json({ error: 'Driver id is required' });
    if (!phone) return response.status(400).json({ error: 'Phone is required' });
    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, driversSheetName, driverHeaders());
    const result = await updateSheetRowById(
      sheets,
      driversSheetName,
      'driver_id',
      driverId,
      { phone, updated_at: new Date().toISOString() },
      () => true,
    );
    if (!result) return response.status(404).json({ error: 'Driver not found' });
    const rows = await getSheetRecords(sheets, driversSheetName);
    response.json({ ok: true, drivers: rows.map(normalizeDriverRow).reverse() });
  } catch (error) {
    response.status(500).json({ error: 'Unable to update driver', message: error.message });
  }
});

app.get('/api/parking-sites', requirePermission('deployments'), async (request, response) => {
  try {
    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, parkingSitesSheetName, parkingSiteHeaders());
    const rows = await getSheetRecords(sheets, parkingSitesSheetName);
    response.json({ parkings: rows.map(normalizeParkingSiteRow).reverse() });
  } catch (error) {
    response.status(500).json({ error: 'Unable to load parking sites', message: error.message });
  }
});

app.post('/api/parking-sites', requirePermission('deployments'), async (request, response) => {
  try {
    const name = String(request.body?.name || '').trim();
    const location = String(request.body?.location || '').trim();
    const gmpLink = String(request.body?.gmpLink || '').trim();
    const spaces = normalizeParkingSpaces(request.body?.totalSpaces);
    if (!name) return response.status(400).json({ error: 'Parking name is required' });
    if (!location) return response.status(400).json({ error: 'Location is required' });
    if (!gmpLink) return response.status(400).json({ error: 'Google Maps link is required' });
    if (!isValidGoogleMapsLink(gmpLink)) return response.status(400).json({ error: 'Use a valid Google Maps link with coordinates' });
    if (spaces === null) return response.status(400).json({ error: 'Spaces must be zero or more' });

    const coords = extractMapCoords(gmpLink) || {};
    const record = {
      parking_id: crypto.randomUUID(),
      name,
      location,
      gmp_link: gmpLink,
      lat: coords.lat || '',
      lng: coords.lng || '',
      total_spaces: spaces ?? 0,
      created_by: request.user.email || request.user.name,
      created_at: new Date().toISOString(),
      updated_at: '',
    };

    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, parkingSitesSheetName, parkingSiteHeaders());
    await appendRecord(sheets, parkingSitesSheetName, parkingSiteHeaders(), record);
    const rows = await getSheetRecords(sheets, parkingSitesSheetName);
    response.json({ ok: true, parkings: rows.map(normalizeParkingSiteRow).reverse() });
  } catch (error) {
    response.status(500).json({ error: 'Unable to save parking site', message: error.message });
  }
});

app.patch('/api/parking-sites/:parkingId', requirePermission('deployments'), async (request, response) => {
  try {
    const parkingId = String(request.params.parkingId || '').trim();
    const spaces = normalizeParkingSpaces(request.body?.totalSpaces);
    if (!parkingId) return response.status(400).json({ error: 'Parking id is required' });
    if (spaces === null) return response.status(400).json({ error: 'Spaces must be zero or more' });

    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, parkingSitesSheetName, parkingSiteHeaders());
    const result = await updateSheetRowById(
      sheets,
      parkingSitesSheetName,
      'parking_id',
      parkingId,
      { total_spaces: spaces ?? 0, updated_at: new Date().toISOString() },
      () => true,
    );
    if (!result) return response.status(404).json({ error: 'Parking site not found' });
    const rows = await getSheetRecords(sheets, parkingSitesSheetName);
    response.json({ ok: true, parkings: rows.map(normalizeParkingSiteRow).reverse() });
  } catch (error) {
    response.status(500).json({ error: 'Unable to update parking site', message: error.message });
  }
});

app.post('/api/driver-session', requirePermission('driver'), async (request, response) => {
  try {
    const assignmentId = String(request.body?.assignmentId || '').trim();
    const nextState = String(request.body?.state || '').trim();
    if (!assignmentId || !['Active session', 'Ended session'].includes(nextState)) {
      return response.status(400).json({ error: 'Valid assignment and session state are required' });
    }
    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, driverAssignmentsSheetName, driverAssignmentHeaders());
    const result = await updateSheetRowById(sheets, driverAssignmentsSheetName, 'assignment_id', assignmentId, {
      session_state: nextState,
      status: nextState === 'Active session' ? 'Started' : 'Completed',
      updated_at: new Date().toISOString(),
    }, (row) => normalizeEmail(row.email || row.Email) === normalizeEmail(request.user.email));
    if (!result) return response.status(404).json({ error: 'Driver assignment not found' });
    response.json({ ok: true, assignment: normalizeDriverAssignmentRow(result) });
  } catch (error) {
    response.status(500).json({ error: 'Unable to update driver session', message: error.message });
  }
});

app.get('/api/tasks', requirePermission('tasks'), async (request, response) => {
  try {
    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, opsTasksSheetName, opsTaskHeaders());
    const rows = scopeRows(await getSheetRecords(sheets, opsTasksSheetName), request.user);
    response.json({ tasks: rows.map(normalizeTaskRow).reverse() });
  } catch (error) {
    response.status(500).json({ error: 'Unable to load ops tasks', message: error.message });
  }
});

app.post('/api/tasks/:taskId/done', requirePermission('tasks'), async (request, response) => {
  try {
    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, opsTasksSheetName, opsTaskHeaders());
    const result = await updateSheetRowById(sheets, opsTasksSheetName, 'task_id', request.params.taskId, {
      status: 'Done',
      completed_by: request.user.email || request.user.name,
      completed_at: new Date().toISOString(),
    }, (row) => canAccessClient(request.user, row.client || row.Client));
    if (!result) return response.status(404).json({ error: 'Task not found' });
    response.json({ ok: true, task: normalizeTaskRow(result) });
  } catch (error) {
    response.status(500).json({ error: 'Unable to complete task', message: error.message });
  }
});

app.get('/api/settings', requirePermission('reports'), async (_request, response) => {
  try {
    const settings = await getDashboardSettings(await getSheetsClient());
    response.json({ settings });
  } catch (error) {
    response.status(500).json({ error: 'Unable to load dashboard settings', message: error.message });
  }
});

app.post('/api/settings', requirePermission('alerts'), async (request, response) => {
  try {
    const settings = normalizeSettings(request.body || {});
    const sheets = await getSheetsClient();
    await ensureSheetWithHeaders(sheets, dashboardSettingsSheetName, ['key', 'value', 'updated_by', 'updated_at']);
    await upsertSettings(sheets, settings, request.user.email || request.user.name);
    response.json({ ok: true, settings });
  } catch (error) {
    response.status(500).json({ error: 'Unable to save dashboard settings', message: error.message });
  }
});

app.get('/api/carbon-trend', requirePermission('fleet'), async (request, response) => {
  try {
    const period = normalizeTrendPeriod(request.query?.period);
    const sheets = await getSheetsClient();
    const settings = await getDashboardSettings(sheets);
    const records = scopeRows(await getCarbonTrendRecords(sheets, period), request.user);
    response.json({ period, unit: 'kgCO2e', points: buildCarbonTrend(records, period, settings) });
  } catch (error) {
    response.status(500).json({ error: 'Unable to load carbon trend', message: error.message });
  }
});

function parseHubInput(value) {
  return String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name = '', gmpLink = '', spaces = ''] = line.split('|').map((part) => part.trim());
        return { name, gmpLink: normalizeMapLink(gmpLink), spaces };
      });
}

function normalizeMapLink(link) {
  const trimmed = String(link || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isValidGoogleMapsLink(link) {
  const normalized = normalizeMapLink(link);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch (error) {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const isGoogleMapsHost = host === 'maps.app.goo.gl'
    || host === 'goo.gl'
    || host.startsWith('maps.google.')
    || ((host === 'google.com' || host.startsWith('www.google.') || host.endsWith('.google.com')) && path.startsWith('/maps'));
  return isGoogleMapsHost && Boolean(extractMapCoords(normalized));
}

function extractMapCoords(link) {
  const value = decodeURIComponent(normalizeMapLink(link));
  const atMatch = value.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const bangMatch = value.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const queryMatch = value.match(/[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const match = atMatch || bangMatch || queryMatch;
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function normalizeParkingSpaces(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const spaces = Number(value);
  return Number.isFinite(spaces) && spaces >= 0 ? Math.floor(spaces) : null;
}

app.get('/api/alerts/preview', requirePermission('alerts'), async (request, response) => {
  try {
    const sheets = await getSheetsClient();
    const recipients = await getAlertRecipients(sheets);
    const rawRecords = scopeRows(await getFleetRecords(sheets), request.user);
    const settings = await getDashboardSettings(sheets);
    const alerts = buildMovementAlerts(rawRecords, settings);
    response.json({
      recipients,
      alerts,
      thresholds: { minDistanceKm: settings.minDistance, minRunningMinutes: settings.minRunTime },
      previousDate: previousDateKey(),
    });
  } catch (error) {
    response.json({ setupNeeded: true, alerts: [], recipients: [], error: 'Unable to preview alerts', message: error.message, setup: alertTabSetup() });
  }
});

app.post('/api/alerts/send', requirePermission('alerts'), async (request, response) => {
  try {
    const sheets = await getSheetsClient();
    const recipients = await getAlertRecipients(sheets);
    const settings = await getDashboardSettings(sheets);
    const alerts = buildMovementAlerts(scopeRows(await getFleetRecords(sheets), request.user), settings);
    if (!recipients.length) return response.status(400).json({ error: 'No active alert recipients configured', setup: alertTabSetup() });
    if (!alerts.length) return response.json({ ok: true, sent: 0, message: 'No vehicles breached movement thresholds.' });
    const subject = `EV movement alert: ${alerts.length} vehicle${alerts.length === 1 ? '' : 's'} need review`;
    const text = formatAlertEmail(alerts, settings);
    const delivery = await sendMail({ to: recipients.map((person) => person.email).join(','), subject, text });
    response.json({ ok: true, sent: recipients.length, vehicles: alerts.length, delivery });
  } catch (error) {
    response.status(500).json({ error: 'Unable to send alerts', message: error.message, setup: alertTabSetup() });
  }
});

const distPath = path.resolve('dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    etag: true,
    maxAge: 0,
    setHeaders(response, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.html')) {
        response.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(distPath, 'index.html'));
  });
}

function normalizeFleetRecords(records, settings = defaultSettings()) {
  const latestByVehicle = new Map();
  for (const record of records) {
    const vehicleNumber = vehicleIdFromRecord(record);
    if (!vehicleNumber) continue;
    const key = vehicleNumber.toUpperCase();
    const currentTime = recordTimeMs(record);
    const previous = latestByVehicle.get(key);
    const previousTime = previous ? recordTimeMs(previous) : -1;
    if (currentTime >= previousTime) latestByVehicle.set(key, record);
  }

  return [...latestByVehicle.values()]
    .map((record) => {
      const vehicleNumber = vehicleIdFromRecord(record);
      const battery = optionalNumber(record, 'battery_percent', 'battery%', 'battery', 'soc');
      const lat = optionalNumber(record, 'latitude', 'lat');
      const lng = optionalNumber(record, 'longitude', 'lng', 'long', 'lon');
      const todayDistance = optionalNumber(record, 'distance_today_km', 'today_distance', 'Dist._today', 'distance_today', 'distance') ?? 0;
      const energyToday = optionalNumber(record, 'energy_today_kwh', 'energy consumed', 'energy') ?? 0;
      const runningMinutes = optionalNumber(record, 'today_running_minutes', 'time today', 'running_minutes');
      const avgSpeed = field(record, 'today_avg_speed_kmph', 'average speed(calculated from distance and time)', 'avg_speed');
      const temp = field(record, 'battery_temperature_c', 'temp', 'temperature');
      const odometer = field(record, 'odometer_km', 'odometer');
      const locationText = field(record, 'location_text', 'location', 'last_location');
      const lastUpdated = field(record, 'vehicle_updated_at', 'last_updated', 'updated_at', 'scraped_at');
      const carbonSaved = carbonSavedVsCng(todayDistance, energyToday, settings);
      return {
        id: vehicleNumber,
        model: field(record, 'vehicle_model', 'vehicle model/model', 'model', 'make_model') || 'Unspecified model',
        sourceSystem: field(record, 'source_system', 'source') || 'Unknown',
        client: field(record, 'client', 'group_names', 'account_username') || 'Unassigned client',
        hub: field(record, 'hub') || 'Unassigned hub',
        parking: field(record, 'parking') || 'Parking unavailable',
        status: normalizeStatus(field(record, 'movement_status_raw', 'vehicle_status_raw', 'charging_status_raw', 'current status of vehicle', 'status')),
        battery: battery && battery <= 100 ? Math.round(battery) : 0,
        distance: 0,
        todayDistance,
        runningTime: field(record, 'running_time', 'runningTime') || minutesLabel(runningMinutes),
        avgSpeed: formatWithUnit(avgSpeed, 'km/h'),
        temp: formatWithUnit(temp, 'C'),
        odometer: formatWithUnit(odometer, 'km'),
        energy: formatWithUnit(energyToday, 'kWh'),
        eta: field(record, 'eta') || 'Unavailable',
        etaDate: field(record, 'eta_date') || '',
        lastUpdated: lastUpdated || 'Unavailable',
        driverState: field(record, 'driver_state') || 'none',
        driver: field(record, 'driver', 'active_driver', 'assigned_driver') || 'No driver confirmed yet',
        driverMeta: field(record, 'driver_meta') || 'Driver sessions not connected yet',
        route: locationText || field(record, 'route') || 'Route unavailable',
        location: locationText || coordinateLabel(lat, lng) || 'Location unavailable',
        lastStop: field(record, 'last_stop_location_text', 'last stop', 'last_stop') || 'Last stop unavailable',
        carbon: carbonSaved === null ? 'Unavailable' : `${carbonSaved.toFixed(1)} kgCO2e`,
        confidence: carbonSaved === null ? 'Unavailable' : 'Estimated vs CNG',
        lat,
        lng,
      };
    })
    .filter((vehicle) => Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng));
}

function field(record, ...keys) {
  const sources = [record, record?.metadata].filter(Boolean);
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (isMeaningful(value)) return value;
    }
  }
  return '';
}

function isMeaningful(value) {
  if (value === undefined || value === null) return false;
  const text = String(value).trim();
  return Boolean(text) && !['N/A', 'Unavailable', 'undefined', 'null', 'NaN'].includes(text);
}

function optionalNumber(record, ...keys) {
  const value = field(record, ...keys);
  if (!isMeaningful(value)) return undefined;
  const number = Number(String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? value);
  return Number.isFinite(number) ? number : undefined;
}

function vehicleIdFromRecord(record) {
  return String(field(record, 'vehicle_number', 'Vehcile_no', 'vehicle_no', 'vehicle_id', 'id', 'vehicle', 'registration') || '').trim().toUpperCase();
}

function recordTimeMs(record) {
  const value = field(record, 'vehicle_updated_at', 'last_updated', 'updated_at', 'scraped_at', 'created_at');
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatWithUnit(value, unit) {
  if (!isMeaningful(value)) return 'Unavailable';
  const text = String(value).trim();
  if (/[a-z%]/i.test(text)) return text;
  const number = Number(text);
  if (!Number.isFinite(number)) return text;
  return `${number} ${unit}`;
}

function coordinateLabel(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `${lat}, ${lng}`;
}

async function getFleetRecords(sheets) {
  return (await getFleetData(sheets)).records;
}

async function getFleetData(sheets) {
  const sheetTitle = await getSheetTitleByGid(sheets, spreadsheetId, sheetGid);
  const records = await getSheetRecords(sheets, sheetTitle);
  return { sheetTitle, records };
}

async function getAlertRecipients(sheets) {
  const rows = await getSheetRecords(sheets, alertRecipientsSheetName);
  return rows
    .map((row) => ({
      name: row.name || row.Name || '',
      email: normalizeEmail(row.email || row.Email),
      role: row.role || row.Role || 'recipient',
      active: normalizeBoolean(row.active ?? row.Active ?? 'TRUE'),
    }))
    .filter((row) => row.email && row.active);
}

function requirePermission(permission) {
  return (request, response, next) => {
    const session = getSession(request);
    const user = session?.user || (!authRequired ? guestUser() : null);
    if (!user) return response.status(401).json({ error: 'Authentication required' });
    if (!canAccess(user, permission)) return response.status(403).json({ error: 'Insufficient permission' });
    request.user = user;
    return next();
  };
}

function canAccess(user, permission) {
  if (!user) return false;
  if (!permission) return true;
  const permissions = user.permissions || [];
  if (permissions.includes('all')) return true;
  if (Array.isArray(permission)) return permission.some((item) => permissions.includes(item));
  return permissions.includes(permission);
}

function canAccessClient(user, client) {
  if (!user) return false;
  if ((user.permissions || []).includes('all')) return true;
  if (!user.client) return true;
  return normalizeClient(user.client) === normalizeClient(client);
}

function scopeRows(rows, user) {
  if (!user || (user.permissions || []).includes('all') || !user.client) return rows;
  return rows.filter((row) => canAccessClient(user, row.client || row.Client || row.group_names || row['Group Names']));
}

function normalizeClient(value) {
  return String(value || '').trim().toLowerCase();
}

function deploymentHeaders() {
  return ['deployment_id', 'vehicle', 'client', 'hub', 'hub_gmp_link', 'hub_lat', 'hub_lng', 'parking', 'parking_gmp_link', 'parking_lat', 'parking_lng', 'previous_undeploy_at', 'deploy_at', 'layover_parking', 'layover_parking_gmp_link', 'layover_parking_lat', 'layover_parking_lng', 'usage', 'poc', 'status', 'created_by', 'created_at', 'removed_by', 'removed_at', 'remove_reason'];
}

function clientHubHeaders() {
  return ['client', 'hub', 'hub_gmp_link', 'hub_lat', 'hub_lng', 'active', 'gst_number', 'client_poc', 'created_at'];
}

function clientParkingHeaders() {
  return ['client', 'parking', 'parking_gmp_link', 'parking_lat', 'parking_lng', 'total_spaces', 'spaces_left', 'active', 'created_at'];
}

function driverAssignmentHeaders() {
  return ['assignment_id', 'name', 'email', 'vehicle', 'client', 'hub', 'shift_date', 'shift', 'status', 'session_state', 'created_by', 'created_at', 'updated_at'];
}

function driverHeaders() {
  return ['driver_id', 'name', 'phone', 'license_number', 'dob', 'email', 'created_by', 'created_at', 'updated_at'];
}

function parkingSiteHeaders() {
  return ['parking_id', 'name', 'location', 'gmp_link', 'lat', 'lng', 'total_spaces', 'created_by', 'created_at', 'updated_at'];
}

function opsTaskHeaders() {
  return ['task_id', 'title', 'vehicle', 'client', 'hub', 'parking', 'poc', 'due', 'reason', 'status', 'created_by', 'created_at', 'completed_by', 'completed_at'];
}

function normalizeDeploymentRow(row) {
  return {
    deploymentId: row.deployment_id || row.deploymentId || '',
    vehicle: row.vehicle || '',
    client: row.client || '',
    hub: row.hub || '',
    hubGmpLink: row.hub_gmp_link || '',
    hubLat: toNumber(row.hub_lat),
    hubLng: toNumber(row.hub_lng),
    parking: row.parking || '',
    parkingGmpLink: row.parking_gmp_link || '',
    parkingLat: toNumber(row.parking_lat),
    parkingLng: toNumber(row.parking_lng),
    previousUndeployAt: row.previous_undeploy_at || '',
    deployAt: row.deploy_at || '',
    layoverParking: row.layover_parking || '',
    layoverParkingGmpLink: row.layover_parking_gmp_link || '',
    layoverParkingLat: toNumber(row.layover_parking_lat),
    layoverParkingLng: toNumber(row.layover_parking_lng),
    usage: row.usage || '',
    poc: row.poc || '',
    status: row.status || 'Active',
    createdAt: row.created_at || '',
    removedBy: row.removed_by || '',
    removedAt: row.removed_at || '',
    removeReason: row.remove_reason || '',
  };
}

function normalizeDriverAssignmentRow(row) {
  return {
    assignmentId: row.assignment_id || row.assignmentId || '',
    name: row.name || '',
    email: row.email || '',
    vehicle: row.vehicle || '',
    client: row.client || '',
    hub: row.hub || '',
    date: row.shift_date || '',
    shift: row.shift_date ? `${row.shift_date} · ${row.shift || ''}`.trim() : row.shift || '',
    rawShift: row.shift || '',
    status: row.status || 'Assigned',
    sessionState: row.session_state || 'Ready',
    createdAt: row.created_at || '',
  };
}

function normalizeDriverRow(row) {
  return {
    driverId: row.driver_id || row.driverId || '',
    name: row.name || '',
    phone: row.phone || '',
    licenseNumber: row.license_number || row.licenseNumber || '',
    dob: row.dob || '',
    email: normalizeEmail(row.email || ''),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function normalizeParkingSiteRow(row) {
  const totalSpaces = toNumber(row.total_spaces) ?? 0;
  return {
    parkingId: row.parking_id || row.parkingId || '',
    name: row.name || '',
    location: row.location || '',
    gmpLink: row.gmp_link || row.gmpLink || row['Google Maps Link'] || '',
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
    totalSpaces,
    spacesLeft: totalSpaces,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

async function createDeploymentTasks(sheets, deployment) {
  await ensureSheetWithHeaders(sheets, opsTasksSheetName, opsTaskHeaders());
  const reason = deployment.previousUndeployAt
    ? `${deployment.usage || 'Deployment'}; previous site undeploy ${deployment.previousUndeployAt}; layover at ${deployment.layoverParking}`
    : `${deployment.usage || 'Deployment'}; layover at ${deployment.layoverParking}`;

  const due = deployment.deployAt || 'Deployment start time';
  const base = {
    vehicle: deployment.vehicle,
    client: deployment.client,
    hub: deployment.hub,
    parking: deployment.parking,
    poc: deployment.poc,
    due,
    reason,
    status: 'Pending',
    created_by: deployment.createdBy || '',
  };

  const titles = [
    'Confirm deployment details with client POC',
    'Park vehicle at assigned parking',
    'Assign driver and confirm shift start',
    deployment.layoverParking && deployment.layoverParking !== deployment.parking ? `Confirm layover parking readiness (${deployment.layoverParking})` : '',
    deployment.previousUndeployAt ? 'End previous deployment and log undeploy time' : '',
  ].filter(Boolean);

  const tasks = [];
  for (const title of titles) {
    // eslint-disable-next-line no-await-in-loop
    const task = await createOpsTask(sheets, { ...base, title });
    tasks.push(task);
  }
  return tasks;
}

function normalizeTaskRow(row) {
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

function coordsFromBody(body, prefix) {
  const lat = toNumber(body?.[`${prefix}Lat`]);
  const lng = toNumber(body?.[`${prefix}Lng`]);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
}

async function appendRecord(sheets, sheetTitle, headers, record) {
  if (useSupabase) {
    const db = (sheets && sheets.supabase) || supabaseModule.getClient();
    try {
      const table = tableForSheetTitle(sheetTitle);
      const payload = {};
      for (const h of headers) {
        const value = record[h] ?? record[h.toLowerCase()];
        if (value !== undefined && value !== '') payload[h] = value;
      }
      await db.from(table).insert(payload);
      clearRecordsCache(sheetTitle);
      return;
    } catch (err) {
      console.error('Supabase appendRecord error', err.message || err);
      throw err;
    }
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetTitle.replace(/'/g, "''")}'!A:${columnLetter(headers.length)}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers.map((header) => record[header] ?? '')] },
  });
  clearRecordsCache(sheetTitle);
}

function clearRecordsCache(sheetTitle) {
  for (const key of sheetRecordsCache.keys()) {
    if (key.endsWith(`:${sheetTitle}`)) sheetRecordsCache.delete(key);
  }
}

function tableForSheetTitle(sheetTitle) {
  if (sheetTitle === authUsersSheetName || sheetTitle === alertRecipientsSheetName) return 'users';
  if (sheetTitle === clientHubsSheetName) return 'hubs';
  if (sheetTitle === clientParkingsSheetName) return 'parkings';
  if (sheetTitle === deploymentsSheetName) return 'deployments';
  if (sheetTitle === driverAssignmentsSheetName) return 'driver_assignments';
  if (sheetTitle === opsTasksSheetName) return 'ops_tasks';
  if (sheetTitle === dashboardSettingsSheetName) return 'settings';
  return String(sheetTitle || '').toLowerCase().replace(/\s+/g, '_');
}

async function createOpsTask(sheets, taskInput) {
  await ensureSheetWithHeaders(sheets, opsTasksSheetName, opsTaskHeaders());
  const task = {
    task_id: crypto.randomUUID(),
    title: taskInput.title,
    vehicle: taskInput.vehicle,
    client: taskInput.client,
    hub: taskInput.hub,
    parking: taskInput.parking,
    poc: taskInput.poc,
    due: taskInput.due,
    reason: taskInput.reason,
    status: taskInput.status || 'Pending',
    created_by: taskInput.created_by || '',
    created_at: new Date().toISOString(),
    completed_by: '',
    completed_at: '',
  };
  await appendRecord(sheets, opsTasksSheetName, opsTaskHeaders(), task);
  return normalizeTaskRow(task);
}

async function getLatestDeploymentsByVehicle(sheets) {
  await ensureSheetWithHeaders(sheets, deploymentsSheetName, deploymentHeaders());
  const rows = await getSheetRecords(sheets, deploymentsSheetName);
  return latestByKey(rows.filter((row) => normalizeBoolean(row.status || 'Active')), 'vehicle', 'created_at');
}

async function getLatestAssignmentsByVehicle(sheets) {
  await ensureSheetWithHeaders(sheets, driverAssignmentsSheetName, driverAssignmentHeaders());
  const rows = await getSheetRecords(sheets, driverAssignmentsSheetName);
  return latestByKey(rows, 'vehicle', 'created_at');
}

function latestByKey(rows, key, timeKey) {
  const latest = new Map();
  for (const row of rows) {
    const id = String(row[key] || '').trim().toUpperCase();
    if (!id) continue;
    const currentTime = new Date(row[timeKey] || 0).getTime() || 0;
    const previous = latest.get(id);
    const previousTime = previous ? new Date(previous[timeKey] || 0).getTime() || 0 : -1;
    if (currentTime >= previousTime) latest.set(id, row);
  }
  return latest;
}

function mergeVehicleOpsData(vehicle, deploymentRow, assignmentRow, index) {
  const deployment = deploymentRow ? normalizeDeploymentRow(deploymentRow) : null;
  const assignment = assignmentRow ? normalizeDriverAssignmentRow(assignmentRow) : null;
  const next = {
    ...vehicle,
    x: vehicle.x ?? 34 + (index % 8) * 6,
    y: vehicle.y ?? 38 + (index % 5) * 8,
  };
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
      driverMeta: `${assignment.status} · ${assignment.shift}`,
    });
  }
  return next;
}

async function updateSheetRowById(sheets, sheetTitle, idHeader, idValue, patch, allowRow = () => true) {
  if (useSupabase) {
    const db = (sheets && sheets.supabase) || supabaseModule.getClient();
    try {
      const table = tableForSheetTitle(sheetTitle);
      const where = {};
      where[idHeader] = idValue;
      const { data: existing } = await db.from(table).select('*').match(where).limit(1);
      const record = (existing && existing[0]) || null;
      if (!record) return null;
      if (!allowRow(record)) return null;
      const { data, error } = await db.from(table).update(patch).match(where).select().limit(1);
      if (error) throw error;
      clearRecordsCache(sheetTitle);
      return (data && data[0]) || null;
    } catch (err) {
      console.error('Supabase updateRow error', err.message || err);
      return null;
    }
  }
  const metadata = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle.replace(/'/g, "''")}'!1:1`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const headers = (metadata.data.values || [])[0] || [];
  if (!headers.length) return null;
  const range = `'${sheetTitle.replace(/'/g, "''")}'!A:${columnLetter(headers.length)}`;
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: 'FORMATTED_VALUE' });
  const [actualHeaders = [], ...rows] = result.data.values || [];
  const idIndex = actualHeaders.indexOf(idHeader);
  if (idIndex < 0) return null;
  const rowIndex = rows.findIndex((row) => String(row[idIndex] || '') === String(idValue));
  if (rowIndex < 0) return null;
  const record = Object.fromEntries(actualHeaders.map((header, index) => [header, rows[rowIndex][index] ?? '']));
  if (!allowRow(record)) return null;
  const updated = { ...record, ...patch };
  const values = actualHeaders.map((header) => updated[header] ?? '');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle.replace(/'/g, "''")}'!A${rowIndex + 2}:${columnLetter(actualHeaders.length)}${rowIndex + 2}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
  clearRecordsCache(sheetTitle);
  return updated;
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

function defaultSettings() {
  return {
    goodCharge: 70,
    minDistance: alertMinDistanceKm,
    minRunTime: alertMinRunningMinutes,
    electricityFactor: 0.72,
    cngFactor: 2.75,
    cngConsumption: cngConsumptionKgPerKm,
    evEnergy: evEnergyKwhPerKm,
  };
}

function normalizeSettings(input) {
  const defaults = defaultSettings();
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

function carbonSavedVsCng(distanceKm, energyKwh, settings) {
  if (!distanceKm) return null;
  const evEnergy = energyKwh || distanceKm * settings.evEnergy;
  const cngEmissions = distanceKm * settings.cngConsumption * settings.cngFactor;
  const electricityEmissions = evEnergy * settings.electricityFactor;
  return Math.max(0, cngEmissions - electricityEmissions);
}

function normalizeTrendPeriod(value) {
  return ['week', 'month', 'year'].includes(String(value || '').toLowerCase())
    ? String(value).toLowerCase()
    : 'week';
}

async function getCarbonTrendRecords(sheets, period) {
  if (useSupabase) {
    const db = (sheets && sheets.supabase) || supabaseModule.getClient();
    const start = trendStartDate(period).toISOString();
    try {
      const { data, error } = await db
        .from('vehicle_snapshots')
        .select('*')
        .gte('scraped_at', start)
        .order('scraped_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Supabase carbon trend fallback:', error.message || error);
    }
  }
  return getFleetRecords(sheets);
}

function buildCarbonTrend(records, period, settings) {
  const buckets = trendBuckets(period);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, { ...bucket, value: 0 }]));
  for (const record of records) {
    const dateValue = field(record, 'scraped_at', 'vehicle_updated_at', 'last_updated', 'updated_at', 'created_at');
    const date = new Date(dateValue || 0);
    if (Number.isNaN(date.getTime())) continue;
    const key = period === 'year' ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10);
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    const directCarbon = optionalNumber(record, 'carbon', 'Carbon saved vs CNG', 'carbon_saved_kg');
    const distance = optionalNumber(record, 'distance_today_km', 'today_distance', 'Dist._today', 'distance_today', 'distance') ?? 0;
    const energy = optionalNumber(record, 'energy_today_kwh', 'energy consumed', 'energy') ?? 0;
    const carbon = directCarbon ?? carbonSavedVsCng(distance, energy, settings);
    if (Number.isFinite(carbon)) bucket.value += carbon;
  }
  return [...bucketMap.values()].map((bucket) => ({
    label: bucket.label,
    value: Number(bucket.value.toFixed(2)),
  }));
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

async function getDashboardSettings(sheets) {
  await ensureSheetWithHeaders(sheets, dashboardSettingsSheetName, ['key', 'value', 'updated_by', 'updated_at']);
  const rows = await getSheetRecords(sheets, dashboardSettingsSheetName);
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return normalizeSettings({ ...defaultSettings(), ...values });
}

async function upsertSettings(sheets, settings, updatedBy) {
  const existing = await getSheetRecords(sheets, dashboardSettingsSheetName);
  const existingKeys = new Set(existing.map((row) => row.key));
  const timestamp = new Date().toISOString();
  for (const [key, value] of Object.entries(settings)) {
    if (existingKeys.has(key)) {
      await updateSheetRowById(sheets, dashboardSettingsSheetName, 'key', key, { value, updated_by: updatedBy, updated_at: timestamp });
    } else {
      await appendRecord(sheets, dashboardSettingsSheetName, ['key', 'value', 'updated_by', 'updated_at'], { key, value, updated_by: updatedBy, updated_at: timestamp });
    }
  }
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function columnLetter(count) {
  let letter = '';
  let number = count;
  while (number > 0) {
    const mod = (number - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    number = Math.floor((number - mod) / 26);
  }
  return letter;
}

async function findUserByEmail(email) {
  const sheets = await getSheetsClient();
  await ensureSheetWithHeaders(sheets, authUsersSheetName, ['name', 'email', 'role', 'client', 'active']);
  const rows = await getSheetRecords(sheets, authUsersSheetName);
  if (!rows.length && defaultAdminEmail) {
    if (useSupabase) {
      const db = supabaseModule.getClient();
      const { error } = await db.from('users').upsert({
        name: defaultAdminName,
        email: defaultAdminEmail,
        role: 'admin',
        client: '',
        active: true,
        permissions: ['all'],
      }, { onConflict: 'email' });
      if (error) throw error;
      clearRecordsCache(authUsersSheetName);
    } else {
      await appendRecord(sheets, authUsersSheetName, ['name', 'email', 'role', 'client', 'active'], {
        name: defaultAdminName,
        email: defaultAdminEmail,
        role: 'admin',
        client: '',
        active: 'TRUE',
      });
    }
    rows.push({ name: defaultAdminName, email: defaultAdminEmail, role: 'admin', client: '', active: 'TRUE' });
  }
  const match = rows.find((row) => normalizeEmail(row.email || row.Email) === email && normalizeBoolean(row.active ?? row.Active ?? 'TRUE'));
  if (!match) return null;
  const role = String(match.role || match.Role || 'client').toLowerCase();
  return {
    name: match.name || match.Name || email,
    email,
    role,
    client: match.client || match.Client || '',
    permissions: permissionsForRole(role),
  };
}

async function getSheetRecords(sheets, sheetTitle) {
  const cacheable = apiCacheSeconds > 0 && sheetTitle !== authUsersSheetName;
  const cacheKey = `${useSupabase ? 'supabase' : 'sheets'}:${sheetTitle}`;
  if (cacheable) {
    const cached = sheetRecordsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.rows;
  }
  const rows = await loadSheetRecords(sheets, sheetTitle);
  if (cacheable) {
    sheetRecordsCache.set(cacheKey, {
      expiresAt: Date.now() + apiCacheSeconds * 1000,
      rows,
    });
  }
  return rows;
}

async function loadSheetRecords(sheets, sheetTitle) {
  if (useSupabase) {
    const db = (sheets && sheets.supabase) || supabaseModule.getClient();
    try {
      if (sheetTitle === authUsersSheetName) {
        const { data } = await db.from('users').select('*');
        return (data || []).map((u) => ({
          name: u.name || '',
          email: u.email,
          role: u.role || ((u.permissions || []).includes('all') ? 'admin' : 'client'),
          client: u.client || '',
          active: u.active === false ? 'FALSE' : 'TRUE',
        }));
      }
      if (sheetTitle === alertRecipientsSheetName) {
        const { data } = await db.from('users').select('*');
        return (data || []).filter((u) => u.active !== false).map((u) => ({ name: u.name || '', email: u.email, role: 'recipient', active: 'TRUE' }));
      }
      if (sheetTitle === clientHubsSheetName) {
        const { data } = await db.from('clients').select('*, hubs(*)');
        const rows = [];
        (data || []).forEach((c) => {
          const gst = c.gst_number || '';
          const poc = c.poc || '';
          if (c.hubs && c.hubs.length) {
            c.hubs.forEach((h) => rows.push({ client: c.name, hub: h.name, hub_gmp_link: h.gmp_link || '', hub_lat: h.lat, hub_lng: h.lng, active: h.enabled ? 'TRUE' : 'FALSE', gst_number: gst, client_poc: poc, created_at: h.created_at }));
          } else {
            rows.push({ client: c.name, hub: '', hub_gmp_link: '', hub_lat: '', hub_lng: '', active: 'TRUE', gst_number: gst, client_poc: poc, created_at: c.created_at });
          }
        });
        return rows;
      }
      if (sheetTitle === clientParkingsSheetName) {
        const { data } = await db.from('clients').select('*, parkings(*)');
        const rows = [];
        (data || []).forEach((c) => {
          (c.parkings || []).forEach((p) => rows.push({
            client: c.name,
            parking: p.name,
            parking_gmp_link: p.gmp_link || '',
            parking_lat: p.lat,
            parking_lng: p.lng,
            total_spaces: p.total_spaces ?? '',
            spaces_left: p.spaces_left ?? '',
            active: p.enabled ? 'TRUE' : 'FALSE',
            created_at: p.created_at,
          }));
        });
        return rows;
      }
      if (sheetTitle === deploymentsSheetName) {
        const { data } = await db.from('deployments').select('*');
        return data || [];
      }
      if (sheetTitle === driverAssignmentsSheetName) {
        const { data } = await db.from('driver_assignments').select('*');
        return data || [];
      }
      if (sheetTitle === opsTasksSheetName) {
        const { data } = await db.from('ops_tasks').select('*');
        return data || [];
      }
      if (sheetTitle === dashboardSettingsSheetName) {
        const { data } = await db.from('settings').select('*');
        return (data || []).map((r) => ({ key: r.key, value: r.value }));
      }
      const table = tableForSheetTitle(sheetTitle);
      const { data } = table === 'vehicles'
        ? await db.from(table).select('*').order('last_updated', { ascending: false })
        : await db.from(table).select('*');
      return data || [];
    } catch (err) {
      console.error('Supabase getSheetRecords error for', sheetTitle, err.message || err);
      return [];
    }
  }
  const range = `'${sheetTitle.replace(/'/g, "''")}'!A:ZZ`;
  const result = await sheets.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: 'FORMATTED_VALUE' });
  const [headers = [], ...rows] = result.data.values || [];
  if (!headers.length) return [];
  return rows
    .filter((row) => row.some((value) => String(value || '').trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [String(header || '').trim(), row[index] ?? ''])));
}

function buildMovementAlerts(records, settings = defaultSettings()) {
  const targetDate = previousDateKey();
  const latestByVehicle = new Map();
  for (const record of records) {
    const vehicle = vehicleIdFromRecord(record);
    if (!vehicle) continue;
    const recordDate = dateKey(field(record, 'vehicle_updated_at', 'last_updated', 'updated_at', 'scraped_at'));
    if (recordDate !== targetDate) continue;
    const currentTime = recordTimeMs(record);
    const previous = latestByVehicle.get(vehicle);
    const previousTime = previous ? recordTimeMs(previous) : -1;
    if (currentTime >= previousTime) latestByVehicle.set(vehicle, record);
  }
  return [...latestByVehicle.values()]
    .map((record) => {
      const distance = optionalNumber(record, 'distance_today_km', 'today_distance', 'Dist._today', 'distance_today', 'distance') ?? 0;
      const runningMinutes = optionalNumber(record, 'today_running_minutes', 'time today', 'running_minutes') ?? 0;
      const reasons = [];
      if (distance < settings.minDistance) reasons.push(`distance ${distance} km < ${settings.minDistance} km`);
      if (runningMinutes < settings.minRunTime) reasons.push(`running ${runningMinutes} min < ${settings.minRunTime} min`);
      return {
        vehicle: vehicleIdFromRecord(record),
        sourceSystem: field(record, 'source_system', 'source') || 'Unknown',
        date: targetDate,
        distanceTodayKm: distance,
        runningMinutes,
        batteryPercent: optionalNumber(record, 'battery_percent', 'battery%', 'battery', 'soc') ?? 0,
        status: normalizeStatus(field(record, 'movement_status_raw', 'vehicle_status_raw', 'charging_status_raw', 'current status of vehicle', 'status')),
        location: field(record, 'location_text', 'location') || coordinateLabel(optionalNumber(record, 'latitude', 'lat'), optionalNumber(record, 'longitude', 'lng', 'long', 'lon')),
        lastUpdated: field(record, 'vehicle_updated_at', 'last_updated', 'updated_at', 'scraped_at') || '',
        reasons,
      };
    })
    .filter((alert) => alert.reasons.length);
}

function formatAlertEmail(alerts, settings = defaultSettings()) {
  return [
    `Kyoto EV Fleet movement alert for ${previousDateKey()}`,
    '',
    `Thresholds: less than ${settings.minDistance} km OR less than ${settings.minRunTime} running minutes.`,
    '',
    ...alerts.map((alert) => [
      `Vehicle: ${alert.vehicle}`,
      `Status: ${alert.status}`,
      `Distance: ${alert.distanceTodayKm} km`,
      `Running time: ${alert.runningMinutes} min`,
      `Battery: ${alert.batteryPercent}%`,
      `Location: ${alert.location}`,
      `Reason: ${alert.reasons.join('; ')}`,
      '',
    ].join('\n')),
  ].join('\n');
}

async function sendMail({ to, subject, text }) {
  if (!process.env.SMTP_HOST) {
    console.log(`[mail:dev] to=${to} subject=${subject}\n${text}`);
    return { mode: 'dev' };
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const info = await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
  return { mode: 'smtp', messageId: info.messageId };
}

function getSession(request) {
  const token = parseCookies(request.headers.cookie || '').kyoto_session;
  const session = token ? sessions.get(token) : null;
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function groupClientHubs(rows, parkingRows = []) {
  const grouped = new Map();
  const ensureClient = (client, row = {}) => {
    const key = normalizeClient(client);
    if (!key) return null;
    if (!grouped.has(key)) {
      grouped.set(key, {
        client,
        gstNumber: String(row.gst_number || row.gstNumber || row.GST || row['GST Number'] || '').trim(),
        clientPoc: String(row.client_poc || row.clientPoc || row.poc || row.POC || row['Client POC'] || '').trim(),
        hubs: new Map(),
        parkings: new Map(),
      });
    }
    const record = grouped.get(key);
    if (!record.gstNumber) record.gstNumber = String(row.gst_number || row.gstNumber || row.GST || row['GST Number'] || '').trim();
    if (!record.clientPoc) record.clientPoc = String(row.client_poc || row.clientPoc || row.poc || row.POC || row['Client POC'] || '').trim();
    return record;
  };

  for (const row of rows) {
    if (!normalizeBoolean(row.active ?? row.Active ?? 'TRUE')) continue;
    const client = String(row.client || row.Client || '').trim();
    const hub = String(row.hub || row.Hub || '').trim();
    const gmpLink = String(row.hub_gmp_link || row['Hub GMP Link'] || row.gmpLink || row['Google Maps Link'] || '').trim();
    const lat = toNumber(row.hub_lat || row['Hub Lat']);
    const lng = toNumber(row.hub_lng || row['Hub Lng']);
    const record = ensureClient(client, row);
    if (record && hub) record.hubs.set(hub, { name: hub, gmpLink, lat, lng });
  }

  for (const row of parkingRows) {
    if (!normalizeBoolean(row.active ?? row.Active ?? 'TRUE')) continue;
    const client = String(row.client || row.Client || '').trim();
    const parking = String(row.parking || row.Parking || '').trim();
    const gmpLink = String(row.parking_gmp_link || row['Parking GMP Link'] || row.gmpLink || row['Google Maps Link'] || '').trim();
    const lat = toNumber(row.parking_lat || row['Parking Lat']);
    const lng = toNumber(row.parking_lng || row['Parking Lng']);
    const totalSpaces = toNumber(row.total_spaces || row.totalSpaces || row['Total Spaces']);
    const spacesLeft = toNumber(row.spaces_left || row.spacesLeft || row['Spaces Left']);
    const record = ensureClient(client, row);
    if (record && parking) record.parkings.set(parking, { name: parking, gmpLink, lat, lng, totalSpaces, spacesLeft });
  }

  return [...grouped.values()].map((record) => ({
    client: record.client,
    gstNumber: record.gstNumber,
    clientPoc: record.clientPoc,
    hubs: [...record.hubs.values()],
    parkings: [...record.parkings.values()],
  }));
}

async function upsertSupabaseClientLocations({
  client,
  gstNumber,
  clientPoc,
  hubs,
  parkings,
  existingKeys,
  existingParkingKeys,
  createdAt,
}) {
  const db = supabaseModule.getClient();
  const { data: clientRows, error: clientError } = await db
    .from('clients')
    .upsert({ name: client, gst_number: gstNumber, poc: clientPoc }, { onConflict: 'name' })
    .select('id')
    .limit(1);
  if (clientError) throw clientError;
  const clientId = clientRows?.[0]?.id;
  if (!clientId) throw new Error('Unable to create or load Supabase client record');

  const hubInserts = hubs
    .filter((hub) => !existingKeys.has(`${client.toLowerCase()}::${hub.name.toLowerCase()}`))
    .map((hub) => {
      const coords = extractMapCoords(hub.gmpLink) || {};
      return {
        client_id: clientId,
        name: hub.name,
        gmp_link: hub.gmpLink,
        lat: coords.lat || null,
        lng: coords.lng || null,
        enabled: true,
        created_at: createdAt,
      };
    });
  const parkingInserts = parkings
    .filter((parking) => !existingParkingKeys.has(`${client.toLowerCase()}::${parking.name.toLowerCase()}`))
    .map((parking) => {
      const coords = extractMapCoords(parking.gmpLink) || {};
      const spaces = normalizeParkingSpaces(parking.spaces) ?? 0;
      return {
        client_id: clientId,
        name: parking.name,
        gmp_link: parking.gmpLink,
        lat: coords.lat || null,
        lng: coords.lng || null,
        total_spaces: spaces,
        spaces_left: spaces,
        enabled: true,
        created_at: createdAt,
      };
    });

  if (hubInserts.length) {
    const { error } = await db.from('hubs').insert(hubInserts);
    if (error) throw error;
  }
  if (parkingInserts.length) {
    const { error } = await db.from('parkings').insert(parkingInserts);
    if (error) throw error;
  }
  clearRecordsCache(clientHubsSheetName);
  clearRecordsCache(clientParkingsSheetName);
}

async function ensureSheetWithHeaders(sheets, sheetTitle, headers) {
  if (useSupabase) return; // Supabase tables don't need header enforcement
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });
  const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === sheetTitle);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] },
    });
  }
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle.replace(/'/g, "''")}'!A1:${String.fromCharCode(64 + headers.length)}1`,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const existingHeaders = (current.data.values || [])[0] || [];
  const hasRequiredHeaders = headers.every((header, index) => String(existingHeaders[index] || '').trim() === header);
  if (!hasRequiredHeaders) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetTitle.replace(/'/g, "''")}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] },
    });
  }
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(cookieHeader.split(';').map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, value.join('=')];
  }).filter(([key]) => key));
}

function sessionCookie(token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `kyoto_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function simplifyPlaceLabel(address) {
  const parts = String(address || '').split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(', ');
  // Keep the most local chunks, drop country-level noise.
  return parts.slice(0, 3).join(', ');
}

function normalizeBoolean(value) {
  return !['false', 'no', '0', 'inactive', 'removed', 'archived'].includes(String(value).trim().toLowerCase());
}

function permissionsForRole(role) {
  if (role === 'admin') return ['all'];
  if (role === 'supervisor' || role === 'ops') return ['fleet', 'deployments', 'drivers', 'tasks', 'reports', 'alerts'];
  if (role === 'driver') return ['driver'];
  return ['fleet', 'reports'];
}

function guestUser() {
  return { name: 'Guest Admin', email: '', role: 'admin', client: '', permissions: ['all'] };
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

function alertTabSetup() {
  return {
    recipientsTab: alertRecipientsSheetName,
    recipientsHeaders: ['name', 'email', 'role', 'active'],
    usersTab: authUsersSheetName,
    userHeaders: ['name', 'email', 'role', 'client', 'active'],
  };
}

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status.includes('running') || status.includes('moving')) return 'Running';
  if (status.includes('charg') || status === 'true') return 'Charging';
  if (status.includes('offline') || status.includes('disconnect') || status.includes('nocomm')) return 'Offline';
  return 'Idle';
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function minutesLabel(value) {
  const minutes = toNumber(value);
  if (!minutes) return 'Unavailable';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Kyoto EV dashboard running on http://127.0.0.1:${port}`);
});

async function getSheetsClient() {
  if (useSupabase) return { supabase: supabaseModule.getClient() };
  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function getSheetTitleByGid(sheets, id, gid) {
  if (useSupabase) return 'vehicles';
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: id,
    fields: 'sheets(properties(sheetId,title))',
  });
  const target = metadata.data.sheets?.find((sheet) => sheet.properties?.sheetId === gid);
  if (!target?.properties?.title) {
    throw new Error(`No sheet tab found for gid ${gid}`);
  }
  return target.properties.title;
}
