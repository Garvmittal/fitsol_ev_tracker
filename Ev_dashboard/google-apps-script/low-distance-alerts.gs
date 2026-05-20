/**
 * Google Apps Script alert worker for deployed EVs with low previous-day distance.
 *
 * Required Script Properties:
 * - SUPABASE_URL: https://your-project-ref.supabase.co
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service-role key
 * - ALERT_MIN_DISTANCE_KM: 10
 * - ALERT_MIN_BATTERY_PERCENT: 10
 *
 * Optional Script Properties:
 * - RECIPIENTS_SPREADSHEET_ID: Google Sheet ID containing the "Alert Recipients" tab.
 *   If blank, the script uses the active spreadsheet.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ALERT_RECIPIENTS_SHEET_NAME = 'Alert Recipients';
const ALERT_LOG_SHEET_NAME = 'Alert Log';
const DEPLOYMENTS_TABLE = 'deployments';
const SNAPSHOTS_TABLE = 'vehicle_snapshots';

function sendLowDistanceAlerts() {
  return sendLowDistanceAlerts_(false);
}

function forceSendLowDistanceAlerts() {
  return sendLowDistanceAlerts_(true);
}

function sendLowDistanceAlerts_(forceSend) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;

  try {
    const props = PropertiesService.getScriptProperties();
    const threshold = Number(props.getProperty('ALERT_MIN_DISTANCE_KM') || 10);
    const minBattery = Number(props.getProperty('ALERT_MIN_BATTERY_PERCENT') || 10);
    const range = previousIstDayRange_();
    const sentKey = `low_distance_alert_sent_${range.label}`;

    Logger.log(`Alert run started for ${range.label}. forceSend=${forceSend}. sentKey=${sentKey}`);

    if (!forceSend && props.getProperty(sentKey) === 'true') {
      Logger.log(`Alerts already sent for ${range.label}`);
      return { ok: true, skipped: true, reason: 'already_sent', date: range.label };
    }

    const recipients = getAlertRecipients_();
    if (!recipients.length) throw new Error(`No active recipients found in "${ALERT_RECIPIENTS_SHEET_NAME}".`);

    const deployments = getDeploymentsForRange_(range.startUtc, range.endUtc);
    const snapshots = getSnapshotSummaryForRange_(range.startUtc, range.endUtc);
    const alerts = buildAlerts_(deployments, snapshots, threshold, minBattery, range.label);

    Logger.log(JSON.stringify({
      date: range.label,
      threshold,
      minBattery,
      recipients: recipients.length,
      recipientEmails: recipients.map((person) => person.email),
      deploymentsDuringDay: deployments.size,
      vehiclesWithSnapshots: snapshots.size,
      vehiclesFlagged: alerts.length,
      sampleAlerts: alerts.slice(0, 5),
    }, null, 2));

    if (!alerts.length) {
      appendAlertLog_(range.label, 'NO_ALERTS', 0, `No deployed vehicles below ${threshold} km with battery above ${minBattery}%.`);
      if (!forceSend) props.setProperty(sentKey, 'true');
      Logger.log('No alert email sent because no vehicles matched the criteria.');
      return { ok: true, sent: 0, reason: 'no_alerts', date: range.label };
    }

    const subject = `EV low-distance alert: ${alerts.length} deployed vehicle${alerts.length === 1 ? '' : 's'}`;
    const body = formatAlertBody_(alerts, threshold, range.label);
    MailApp.sendEmail({
      to: recipients.map((person) => person.email).join(','),
      subject,
      body,
      name: 'Fitsol EV Tracker',
    });

    appendAlertLog_(range.label, 'SENT', alerts.length, recipients.map((person) => person.email).join(', '));
    if (!forceSend) props.setProperty(sentKey, 'true');
    Logger.log(`Alert email sent to ${recipients.map((person) => person.email).join(', ')} for ${alerts.length} vehicle(s).`);
    return { ok: true, sent: recipients.length, vehicles: alerts.length, date: range.label };
  } finally {
    lock.releaseLock();
  }
}

function sendTestEmail() {
  const recipients = getAlertRecipients_();
  if (!recipients.length) throw new Error(`No active recipients found in "${ALERT_RECIPIENTS_SHEET_NAME}".`);
  const to = recipients.map((person) => person.email).join(',');
  MailApp.sendEmail({
    to,
    subject: 'Fitsol EV Tracker test email',
    body: `This is a test email from Google Apps Script.\n\nSent at: ${new Date().toISOString()}`,
    name: 'Fitsol EV Tracker',
  });
  Logger.log(`Test email sent to ${to}`);
  return { ok: true, sent: recipients.length, to };
}

function sendTestEmailToMe() {
  const email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  if (!email) throw new Error('Could not read your Google account email. Use sendTestEmail with Alert Recipients instead.');
  MailApp.sendEmail({
    to: email,
    subject: 'Fitsol EV Tracker self-test email',
    body: `This is a direct self-test from Google Apps Script.\n\nSent at: ${new Date().toISOString()}`,
    name: 'Fitsol EV Tracker',
  });
  Logger.log(`Self-test email sent to ${email}`);
  return { ok: true, to: email };
}

function resetTodayAlertSentFlag() {
  const range = previousIstDayRange_();
  const sentKey = `low_distance_alert_sent_${range.label}`;
  PropertiesService.getScriptProperties().deleteProperty(sentKey);
  Logger.log(`Deleted ${sentKey}`);
  return { ok: true, deleted: sentKey };
}

function previewLowDistanceAlerts() {
  const props = PropertiesService.getScriptProperties();
  const threshold = Number(props.getProperty('ALERT_MIN_DISTANCE_KM') || 10);
  const minBattery = Number(props.getProperty('ALERT_MIN_BATTERY_PERCENT') || 10);
  const range = previousIstDayRange_();
  const deployments = getDeploymentsForRange_(range.startUtc, range.endUtc);
  const snapshots = getSnapshotSummaryForRange_(range.startUtc, range.endUtc);
  const alerts = buildAlerts_(deployments, snapshots, threshold, minBattery, range.label);
  Logger.log(JSON.stringify({ date: range.label, threshold, minBattery, alerts }, null, 2));
  return alerts;
}

function testLowDistanceAlertSetup() {
  const recipients = getAlertRecipients_();
  const props = PropertiesService.getScriptProperties();
  const threshold = Number(props.getProperty('ALERT_MIN_DISTANCE_KM') || 10);
  const minBattery = Number(props.getProperty('ALERT_MIN_BATTERY_PERCENT') || 10);
  const range = previousIstDayRange_();
  const deployments = getDeploymentsForRange_(range.startUtc, range.endUtc);
  const snapshots = getSnapshotSummaryForRange_(range.startUtc, range.endUtc);
  const alerts = buildAlerts_(deployments, snapshots, threshold, minBattery, range.label);
  const result = {
    ok: true,
    date: range.label,
    threshold,
    minBattery,
    recipients: recipients.length,
    deploymentsDuringDay: deployments.size,
    vehiclesWithSnapshots: snapshots.size,
    vehiclesFlagged: alerts.length,
    sampleAlerts: alerts.slice(0, 5),
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function createDailyAlertTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'sendLowDistanceAlerts')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('sendLowDistanceAlerts')
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .create();
}

function previousIstDayRange_() {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const todayIst = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
  const targetIst = new Date(todayIst.getTime() - 24 * 60 * 60 * 1000);
  const startUtc = new Date(targetIst.getTime() - IST_OFFSET_MS);
  const endUtc = new Date(targetIst.getTime() + 24 * 60 * 60 * 1000 - IST_OFFSET_MS);
  const label = [
    targetIst.getUTCFullYear(),
    String(targetIst.getUTCMonth() + 1).padStart(2, '0'),
    String(targetIst.getUTCDate()).padStart(2, '0'),
  ].join('-');
  return { label, startUtc, endUtc };
}

function getAlertRecipients_() {
  const sheet = getSpreadsheet_().getSheetByName(ALERT_RECIPIENTS_SHEET_NAME);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift().map((header) => normalizeHeader_(header));
  return rows
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])))
    .filter((row) => String(row.active || 'TRUE').toLowerCase() !== 'false')
    .map((row) => ({ name: String(row.name || '').trim(), email: String(row.email || '').trim() }))
    .filter((row) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email));
}

function getDeploymentsForRange_(startUtc, endUtc) {
  const rows = supabaseSelect_(DEPLOYMENTS_TABLE, {
    select: '*',
    order: 'created_at.desc',
    limit: 5000,
  });
  const latest = new Map();
  const seen = new Set();
  rows.forEach((row) => {
    const vehicle = vehicleKey_(row.vehicle);
    if (!vehicle || seen.has(vehicle)) return;
    if (!deploymentOverlapsRange_(row, startUtc, endUtc)) return;
    seen.add(vehicle);
    latest.set(vehicle, row);
  });
  return latest;
}

function getSnapshotSummaryForRange_(startUtc, endUtc) {
  const rows = supabaseSelect_(SNAPSHOTS_TABLE, {
    select: 'vehicle_number,vehicle_id,scraped_at,source,distance_today_km,today_running_minutes,battery_percent,movement_status_raw,last_stop_location_text,latitude,longitude',
    scraped_at: `gte.${startUtc.toISOString()}`,
    scraped_at_lt: `lt.${endUtc.toISOString()}`,
    order: 'scraped_at.desc',
    limit: 10000,
  });
  const summaries = new Map();
  rows.forEach((row) => {
    const vehicle = snapshotVehicleKey_(row);
    if (!vehicle) return;
    const existing = summaries.get(vehicle) || {
      latest: null,
      maxBatteryPercent: 0,
      maxDistanceTodayKm: 0,
      maxRunningMinutes: 0,
      readingCount: 0,
    };
    existing.readingCount += 1;
    existing.maxBatteryPercent = Math.max(existing.maxBatteryPercent, numberValue_(row.battery_percent));
    existing.maxDistanceTodayKm = Math.max(existing.maxDistanceTodayKm, numberValue_(row.distance_today_km));
    existing.maxRunningMinutes = Math.max(existing.maxRunningMinutes, numberValue_(row.today_running_minutes));
    if (!existing.latest || timeMs_(row.scraped_at) > timeMs_(existing.latest.scraped_at)) existing.latest = row;
    summaries.set(vehicle, existing);
  });
  return summaries;
}

function buildAlerts_(deployments, snapshots, threshold, minBattery, dateLabel) {
  const alerts = [];
  deployments.forEach((deployment, vehicle) => {
    const summary = snapshots.get(vehicle);
    if (!summary?.latest) return;
    if (summary.maxBatteryPercent <= minBattery) return;
    const snapshot = summary.latest;
    const distance = summary.maxDistanceTodayKm;
    if (distance >= threshold) return;
    alerts.push({
      vehicle,
      client: deployment.client || '',
      hub: deployment.hub || '',
      parking: deployment.parking || '',
      date: dateLabel,
      distanceTodayKm: distance,
      runningMinutes: summary.maxRunningMinutes,
      batteryPercent: summary.maxBatteryPercent,
      latestBatteryPercent: numberValue_(snapshot.battery_percent),
      readingCount: summary.readingCount,
      status: snapshot.movement_status_raw || '',
      source: snapshot.source || '',
      lastStop: snapshot.last_stop_location_text || coordinateLabel_(snapshot.latitude, snapshot.longitude),
      scrapedAtUtc: snapshot.scraped_at || '',
    });
  });
  return alerts.sort((a, b) => a.distanceTodayKm - b.distanceTodayKm);
}

function formatAlertBody_(alerts, threshold, dateLabel) {
  const lines = [
    `Fitsol EV low-distance alert for ${dateLabel}`,
    '',
    `Rule: vehicles deployed yesterday with total distance below ${threshold} km and at least one battery reading above ${Number(PropertiesService.getScriptProperties().getProperty('ALERT_MIN_BATTERY_PERCENT') || 10)}%.`,
    '',
  ];
  alerts.forEach((alert, index) => {
    lines.push(
      `${index + 1}. ${alert.vehicle}`,
      `Client: ${alert.client || 'Unassigned'}`,
      `Hub: ${alert.hub || 'Unassigned'}`,
      `Distance: ${alert.distanceTodayKm} km`,
      `Running time: ${alert.runningMinutes} min`,
      `Max battery yesterday: ${alert.batteryPercent}%`,
      `Latest battery in day: ${alert.latestBatteryPercent}%`,
      `Snapshot count: ${alert.readingCount}`,
      `Status: ${alert.status || 'Unknown'}`,
      `Last stop: ${alert.lastStop || 'Unavailable'}`,
      `Scraped UTC: ${alert.scrapedAtUtc || 'Unavailable'}`,
      ''
    );
  });
  return lines.join('\n');
}

function deploymentOverlapsRange_(row, startUtc, endUtc) {
  const started = timeMs_(row.deploy_at || row.created_at) || 0;
  const removed = timeMs_(row.removed_at);
  const status = String(row.status || 'Active').toLowerCase();
  if (started >= endUtc.getTime()) return false;
  if (removed && removed < startUtc.getTime()) return false;
  if (status === 'removed' && !removed) return false;
  return true;
}

function supabaseSelect_(table, params) {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('SUPABASE_URL');
  const serviceKey = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceKey) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Script Properties.');

  const query = [];
  Object.entries(params).forEach(([key, value]) => {
    if (key === 'scraped_at_lt') query.push(`scraped_at=${encodeURIComponent(value)}`);
    else query.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  });

  const response = UrlFetchApp.fetch(`${baseUrl.replace(/\/$/, '')}/rest/v1/${table}?${query.join('&')}`, {
    method: 'get',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json',
    },
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  const text = response.getContentText();
  if (status < 200 || status >= 300) throw new Error(`Supabase ${table} failed (${status}): ${text}`);
  return JSON.parse(text || '[]');
}

function appendAlertLog_(dateLabel, status, vehicleCount, detail) {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(ALERT_LOG_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(ALERT_LOG_SHEET_NAME);
    sheet.appendRow(['sent_at', 'alert_date', 'status', 'vehicle_count', 'detail']);
  }
  sheet.appendRow([new Date(), dateLabel, status, vehicleCount, detail]);
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('RECIPIENTS_SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function vehicleKey_(value) {
  return String(value || '').trim().toUpperCase();
}

function snapshotVehicleKey_(row) {
  return vehicleKey_(row.vehicle_number || row.Vehcile_no || row.vehicle_no || row.vehicle || row.vehicle_id || row.id);
}

function numberValue_(value) {
  const number = Number(String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] || 0);
  return Number.isFinite(number) ? number : 0;
}

function timeMs_(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function coordinateLabel_(lat, lng) {
  return lat && lng ? `${lat}, ${lng}` : '';
}
