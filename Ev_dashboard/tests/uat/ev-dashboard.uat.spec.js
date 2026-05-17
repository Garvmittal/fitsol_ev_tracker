import { expect, test } from '@playwright/test';
import 'dotenv/config';

const apiBaseUrl = 'http://127.0.0.1:3001';

const fleetPayload = {
  sheetTitle: 'Final Detailed Vehicle Snapshots',
  vehicles: [
    {
      id: 'HR55AY2609',
      client: 'Unassigned client',
      hub: 'Unassigned hub',
      parking: 'Parking unavailable',
      status: 'Idle',
      battery: 35,
      todayDistance: 94.67,
      runningTime: '4h 1m',
      avgSpeed: 'Unavailable',
      temp: '30 C',
      odometer: '18992 km',
      energy: 'Unavailable',
      carbon: 'Unavailable',
      confidence: 'Unavailable',
      driver: 'No driver confirmed yet',
      driverState: 'none',
      driverMeta: 'Driver sessions not connected yet',
      location: '28.6139, 77.2090',
      lastStop: 'Last stop unavailable',
      lat: 28.6139,
      lng: 77.2090,
    },
    {
      id: 'DL51EV1938',
      client: 'Unassigned client',
      hub: 'Unassigned hub',
      parking: 'Parking unavailable',
      status: 'Running',
      battery: 72,
      todayDistance: 18,
      runningTime: '11h 50m',
      avgSpeed: '14.43 km/h',
      temp: '31 C',
      odometer: '12215 km',
      energy: 'Unavailable',
      carbon: 'Unavailable',
      confidence: 'Unavailable',
      driver: 'No driver confirmed yet',
      driverState: 'none',
      driverMeta: 'Driver sessions not connected yet',
      location: '28.3752, 77.0732',
      lastStop: 'Last stop unavailable',
      lat: 28.3752,
      lng: 77.0732,
    },
  ],
};

const mappedClients = [
  {
    client: 'Acme Logistics',
    hubs: [{ name: 'Delhi Hub', gmpLink: 'https://www.google.com/maps/@28.6139,77.2090,17z', lat: 28.6139, lng: 77.2090 }],
  },
];

async function mockUiApis(page, initialClients = [], options = {}) {
  let clients = initialClients;
  let assignments = [];
  let tasks = [];
  let settings = {
    goodCharge: 70,
    minDistance: 1,
    minRunTime: 10,
    electricityFactor: 0.72,
    cngFactor: 2.75,
    cngConsumption: 0.18,
    evEnergy: 0.22,
  };
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ json: { user: { name: 'UAT Admin', role: 'admin', permissions: ['all'] }, authRequired: false } });
  });
  await page.route('**/api/config', async (route) => {
    await route.fulfill({ json: { googleMaps: { enabled: false, apiKey: '', mapId: '', missing: { apiKey: true, mapId: true } } } });
  });
  await page.route('**/api/fleet', async (route) => {
    await route.fulfill({ json: fleetPayload });
  });
  await page.route('**/api/client-hubs', async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      const hubs = String(body.hubs || '')
        .split(/\r?\n/)
        .map((line) => {
          const [name = '', ...linkParts] = line.trim().split('|');
          return { name: name.trim(), gmpLink: linkParts.join('|').trim(), lat: 28.6139, lng: 77.2090 };
        })
        .filter((hub) => hub.name && hub.gmpLink);
      clients = [{ client: body.client, hubs }];
      await route.fulfill({ json: { ok: true, clients } });
      return;
    }
    await route.fulfill({ json: { clients } });
  });
  await page.route('**/api/deployments', async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      const task = {
        id: 'uat-task-1',
        title: 'Park vehicle at assigned parking',
        vehicle: body.vehicle,
        client: body.client,
        hub: body.hub,
        parking: body.parking,
        poc: body.poc,
        due: 'Deployment start time',
        reason: body.usage,
        status: 'Pending',
      };
      tasks = [task, ...tasks];
      await route.fulfill({ json: { ok: true, deployment: body, task } });
      return;
    }
    await route.fulfill({ json: { deployments: [] } });
  });
  await page.route('**/api/driver-assignments', async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      const assignment = {
        assignmentId: 'uat-assignment-1',
        name: body.name,
        email: body.email,
        vehicle: body.vehicle,
        client: body.client,
        hub: body.hub,
        date: body.date,
        shift: `${body.date} - ${body.shift}`,
        rawShift: body.shift,
        status: 'Assigned',
        sessionState: 'Ready',
      };
      assignments = [assignment, ...assignments];
      await route.fulfill({ json: { ok: true, assignment } });
      return;
    }
    await route.fulfill({ json: { assignments } });
  });
  await page.route('**/api/driver-session', async (route) => {
    if (options.failDriverSession) {
      await route.fulfill({ status: 500, json: { error: 'Unable to update driver session' } });
      return;
    }
    const body = JSON.parse(route.request().postData() || '{}');
    assignments = assignments.map((assignment) => (
      assignment.assignmentId === body.assignmentId
        ? { ...assignment, sessionState: body.state, status: body.state === 'Active session' ? 'Started' : 'Completed' }
        : assignment
    ));
    await route.fulfill({ json: { ok: true, assignment: assignments.find((assignment) => assignment.assignmentId === body.assignmentId) } });
  });
  await page.route('**/api/tasks/*/done', async (route) => {
    const taskId = route.request().url().split('/api/tasks/')[1].split('/done')[0];
    tasks = tasks.map((task) => (task.id === taskId ? { ...task, status: 'Done' } : task));
    await route.fulfill({ json: { ok: true, task: tasks.find((task) => task.id === taskId) } });
  });
  await page.route('**/api/tasks', async (route) => {
    await route.fulfill({ json: { tasks } });
  });
  await page.route('**/api/settings', async (route) => {
    if (route.request().method() === 'POST') {
      settings = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ json: { ok: true, settings } });
      return;
    }
    await route.fulfill({ json: { settings } });
  });
}

test.describe('UAT gate: real backend readiness', () => {
  test('vehicle sheet and maps config are reachable', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'API readiness only needs one pass');

    let fleet = await request.get(`${apiBaseUrl}/api/fleet`);
    if (fleet.status() === 401) {
      const email = process.env.DEFAULT_ADMIN_EMAIL;
      expect(email, 'DEFAULT_ADMIN_EMAIL is required when AUTH_REQUIRED=true').toBeTruthy();
      const otpRequest = await request.post(`${apiBaseUrl}/api/auth/request-otp`, { data: { email } });
      expect(otpRequest.ok()).toBeTruthy();
      const otpPayload = await otpRequest.json();
      expect(otpPayload.devOtp, 'OTP_DEV_MODE=true is required for automated UAT auth').toBeTruthy();
      const verify = await request.post(`${apiBaseUrl}/api/auth/verify-otp`, { data: { email, otp: otpPayload.devOtp } });
      expect(verify.ok()).toBeTruthy();
      fleet = await request.get(`${apiBaseUrl}/api/fleet`);
    }
    expect(fleet.ok()).toBeTruthy();
    const fleetJson = await fleet.json();
    expect(fleetJson.sheetTitle).toBe('Final Detailed Vehicle Snapshots');
    expect(fleetJson.vehicles.length).toBeGreaterThan(0);

    const config = await request.get(`${apiBaseUrl}/api/config`);
    expect(config.ok()).toBeTruthy();
    const configJson = await config.json();
    expect(configJson.googleMaps.enabled).toBeTruthy();
  });
});

test.describe('UAT gate: operations flow permutations', () => {
  test('blocks deployment until a client has at least one mapped hub', async ({ page }) => {
    await mockUiApis(page, []);
    await page.goto('/');
    await page.getByRole('button', { name: 'Operations' }).click();

    await expect(page.getByText('Add a client with at least one mapped hub before deployment.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Deployment' })).toBeDisabled();
  });

  test('rejects client onboarding when hub Google Maps link is missing', async ({ page }) => {
    await mockUiApis(page, []);
    await page.goto('/');
    await page.getByRole('button', { name: 'Operations' }).click();

    await page.getByLabel('Client').last().fill('Acme Logistics');
    await page.getByLabel('Hubs + Google Maps links').fill('Delhi Hub');
    await page.getByRole('button', { name: 'Save Client For Reuse' }).click();

    await expect(page.getByText('Each hub needs a name and Google Maps link.')).toBeVisible();
  });

  test('adds client hubs inline, then deploys an existing Sheet vehicle to hub and parking', async ({ page }) => {
    await mockUiApis(page, []);
    await page.goto('/');
    await page.getByRole('button', { name: 'Operations' }).click();

    await page.getByLabel('Client').last().fill('Acme Logistics');
    await page.getByLabel('Hubs + Google Maps links').fill('Delhi Hub | https://www.google.com/maps/@28.6139,77.2090,17z');
    await page.getByRole('button', { name: 'Save Client For Reuse' }).click();
    await expect(page.getByText('Client hubs saved to Google Sheets.')).toBeVisible();

    const deploymentForm = page.locator('form.ops-form').filter({ hasText: 'Deploy Vehicle To Client' });
    await deploymentForm.locator('select[name="vehicle"]').selectOption('HR55AY2609');
    await deploymentForm.locator('select[name="client"]').selectOption('Acme Logistics');
    await deploymentForm.locator('select[name="hub"]').selectOption('Delhi Hub');
    await deploymentForm.locator('input[name="parking"]').fill('Gate A Parking');
    await deploymentForm.locator('input[name="parkingGmpLink"]').fill('https://www.google.com/maps/@28.6139,77.2090,18z');
    await deploymentForm.locator('input[name="poc"]').fill('UAT Owner');
    await page.getByRole('button', { name: 'Save Deployment' }).click();

    await expect(page.getByText('Existing Sheet vehicle assigned to client hub.')).toBeVisible();
    await expect(page.getByText('Park vehicle at assigned parking')).toBeVisible();
    await page.getByRole('button', { name: 'Mark done' }).click();
    await expect(page.getByText('Task marked done with completion timestamp.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled();
    await page.getByRole('button', { name: 'EV Fleet' }).click();
    await expect(page.getByText('Place status: Inside parking')).toBeVisible();
  });

  test('driver assignment updates fleet and reports controls remain usable', async ({ page }) => {
    await mockUiApis(page, mappedClients);
    await page.goto('/');
    await page.getByRole('button', { name: 'Operations' }).click();

    await page.getByLabel('Driver').fill('UAT Driver');
    await page.getByLabel('Login email').fill('uat.driver@example.com');
    await page.getByLabel('Vehicle').last().selectOption('DL51EV1938');
    await page.getByLabel('Date').fill('2026-05-11');
    await page.getByLabel('Shift').fill('9:00 AM - 6:00 PM');
    await page.getByRole('button', { name: 'Assign Driver' }).click();
    await expect(page.getByText('Driver assignment saved. Driver can now start the session.')).toBeVisible();

    await page.getByRole('button', { name: 'EV Fleet' }).click();
    await page.getByPlaceholder('Search...').fill('DL51EV1938');
    await expect(page.getByText('Assigned driver today')).toBeVisible();
    await expect(page.getByText('UAT Driver')).toBeVisible();

    await page.getByRole('button', { name: 'Reports' }).click();
    await expect(page.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
  });

  test('driver session does not move locally when backend rejects it', async ({ page }) => {
    await mockUiApis(page, mappedClients, { failDriverSession: true });
    await page.goto('/');
    await page.getByRole('button', { name: 'Operations' }).click();

    await page.getByLabel('Driver').fill('UAT Driver');
    await page.getByLabel('Login email').fill('uat.driver@example.com');
    await page.getByLabel('Vehicle').last().selectOption('DL51EV1938');
    await page.getByLabel('Date').fill('2026-05-11');
    await page.getByLabel('Shift').fill('9:00 AM - 6:00 PM');
    await page.getByRole('button', { name: 'Assign Driver' }).click();
    await expect(page.getByText('Driver assignment saved. Driver can now start the session.')).toBeVisible();

    await page.getByRole('button', { name: 'Driver', exact: true }).click();
    await expect(page.locator('.driver-card mark')).toHaveText('Ready');
    await page.getByRole('button', { name: 'Start Session' }).click();
    await expect(page.getByText('Unable to update driver session')).toBeVisible();
    await expect(page.locator('.driver-card mark')).toHaveText('Ready');
  });

  test('settings save updates admin summary immediately', async ({ page }) => {
    await mockUiApis(page, mappedClients);
    await page.goto('/');
    await page.getByRole('button', { name: 'Admin' }).click();

    await page.getByLabel('Good charge threshold (%)').fill('82');
    await page.getByLabel('Minimum movement per day (km)').fill('2.5');
    await page.getByRole('button', { name: 'Save Settings' }).click();

    await expect(page.getByText('Alert thresholds and carbon factors saved.')).toBeVisible();
    await expect(page.getByText('Vehicles above 82% charge and below 2.5 km movement are eligible for unused-vehicle alerts.')).toBeVisible();
  });
});
