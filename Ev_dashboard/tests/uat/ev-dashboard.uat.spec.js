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
  const fleet = options.fleet || fleetPayload;
  let portals = options.portals || [];
  let parkings = options.parkings || [
    { parkingId: 'uat-parking-1', name: 'Gate A Parking', location: 'UAT', gmpLink: 'https://www.google.com/maps/@28.6139,77.2090,18z', lat: 28.6139, lng: 77.209 },
  ];
  let drivers = options.drivers || [
    { driverId: 'uat-driver-1', name: 'UAT Driver', phone: '+91 99999 99999', licenseNumber: 'LIC123', dob: '1990-01-01', email: 'uat.driver@example.com' },
  ];
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
    await route.fulfill({ json: fleet });
  });
  await page.route('**/api/reverse-geocode**', async (route) => {
    await route.fulfill({ json: { place: 'UAT Landmark' } });
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
      clients = [{ client: body.client, hubs, parkings: [] }];
      await route.fulfill({ json: { ok: true, clients } });
      return;
    }
    await route.fulfill({ json: { clients } });
  });
  await page.route('**/api/client-portals', async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      portals = [{
        portalId: `uat-portal-${portals.length + 1}`,
        shareToken: `uat-token-${portals.length + 1}`,
        label: body.label,
        client: body.client,
        allowedEmails: String(body.allowedEmails || '').split(/[\s,;]+/).filter(Boolean),
        active: true,
      }, ...portals];
      await route.fulfill({ json: { ok: true, portals } });
      return;
    }
    await route.fulfill({ json: { portals } });
  });
  await page.route('**/api/client-portals/*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const body = JSON.parse(route.request().postData() || '{}');
    const portalId = route.request().url().split('/').pop();
    portals = portals.map((portal) => (portal.portalId === portalId ? {
      ...portal,
      label: body.label,
      allowedEmails: String(body.allowedEmails || '').split(/[\s,;]+/).filter(Boolean),
      active: body.active !== false,
    } : portal));
    await route.fulfill({ json: { ok: true, portals } });
  });
  await page.route('**/api/deployments', async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      const created = [
        {
          id: 'uat-task-1',
          title: 'Confirm deployment details with client POC',
          vehicle: body.vehicle,
          client: body.client,
          hub: body.hub,
          parking: body.parking,
          poc: body.poc,
          due: body.deployAt || 'Deployment start time',
          reason: body.usage || '',
          status: 'Pending',
        },
        {
          id: 'uat-task-2',
          title: 'Park vehicle at assigned parking',
          vehicle: body.vehicle,
          client: body.client,
          hub: body.hub,
          parking: body.parking,
          poc: body.poc,
          due: body.deployAt || 'Deployment start time',
          reason: body.usage || '',
          status: 'Pending',
        },
      ];
      tasks = [...created, ...tasks];
      await route.fulfill({ json: { ok: true, deployment: body, tasks: created } });
      return;
    }
    await route.fulfill({ json: { deployments: [] } });
  });

  await page.route('**/api/deployments/end', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const task = {
      id: 'uat-task-end-1',
      title: `Undeploy vehicle and park at ${body.parking}`,
      vehicle: body.vehicle,
      client: 'Acme Logistics',
      hub: 'Delhi Hub',
      parking: body.parking,
      poc: '',
      due: body.effectiveAt,
      reason: body.reason || '',
      status: 'Pending',
    };
    tasks = [task, ...tasks];
    await route.fulfill({ json: { ok: true, deployment: { vehicle: body.vehicle }, task } });
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

  await page.route('**/api/parking-sites', async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      parkings = [{ parkingId: `uat-parking-${parkings.length + 1}`, ...body }, ...parkings];
      await route.fulfill({ json: { ok: true, parkings } });
      return;
    }
    await route.fulfill({ json: { parkings } });
  });

  await page.route('**/api/drivers', async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      drivers = [{ driverId: `uat-driver-${drivers.length + 1}`, ...body }, ...drivers];
      await route.fulfill({ json: { ok: true, drivers } });
      return;
    }
    await route.fulfill({ json: { drivers } });
  });
  await page.route('**/api/drivers/*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const body = JSON.parse(route.request().postData() || '{}');
    const id = route.request().url().split('/').pop();
    drivers = drivers.map((d) => ((d.driverId || d.id) === id ? { ...d, phone: body.phone ?? d.phone } : d));
    await route.fulfill({ json: { ok: true, drivers } });
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
  test('backend health + config are reachable', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'API readiness only needs one pass');

    const health = await request.get(`${apiBaseUrl}/api/health`);
    expect(health.ok()).toBeTruthy();

    const config = await request.get(`${apiBaseUrl}/api/config`);
    expect(config.ok()).toBeTruthy();
    const configJson = await config.json();
    expect(configJson.googleMaps).toBeTruthy();
  });
});

test.describe('UAT gate: operations flow permutations', () => {
  test('creates a client live link and updates its allowed emails', async ({ page }) => {
    await mockUiApis(page, mappedClients, { portals: [] });
    await page.goto('/');
    await page.getByRole('button', { name: 'Operations' }).click();
    await page.getByRole('button', { name: 'Create client link' }).click();
    await page.getByLabel('Link name').fill('Acme dispatch live');
    await page.getByLabel('Allowed email IDs').fill('dispatch@acme.example');
    await page.getByRole('button', { name: 'Create link' }).click();
    await expect(page.getByText('Acme dispatch live')).toBeVisible();
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Allowed email IDs').fill('dispatch@acme.example\nmanager@acme.example');
    await page.getByRole('button', { name: 'Save access' }).click();
    await expect(page.getByRole('region', { name: 'Client live links table' }).getByRole('cell', { name: '2', exact: true })).toBeVisible();
  });

  test('deploy modal offers Add client fallback when no clients exist', async ({ page }) => {
    await mockUiApis(page, []);
    await page.goto('/');
    await page.getByRole('button', { name: 'Operations' }).click();
    await page.getByRole('button', { name: 'Deploy vehicle' }).click();
    await expect(page.getByRole('heading', { name: 'Deploy Vehicle' })).toBeVisible();
    await page.getByRole('button', { name: 'Add client' }).click();
    await expect(page.getByRole('heading', { name: 'Add Client' })).toBeVisible();
  });

  test('rejects client onboarding when hub Google Maps link is invalid', async ({ page }) => {
    await mockUiApis(page, []);
    await page.goto('/');
    await page.getByRole('button', { name: 'Operations' }).click();
    await page.getByRole('button', { name: 'Deploy vehicle' }).click();
    await page.getByRole('button', { name: 'Add client' }).click();

    await page.getByLabel('GST number').fill('GST-1');
    await page.getByLabel('Client name').fill('Acme Logistics');
    await page.getByLabel('POC name').fill('UAT Owner');
    await page.getByLabel('POC email').fill('uat.owner@example.com');
    await page.getByLabel('POC phone').fill('+91 99999 11111');
    await page.getByLabel('Hub name').fill('Delhi Hub');
    await page.getByLabel('Google Maps link').fill('random-link');
    const addClientModal = page.locator('.modal-card', { has: page.getByRole('heading', { name: 'Add Client' }) });
    await addClientModal.locator('button[type=\"submit\"]').click();

    await expect(page.getByText('Use valid Google Maps links with coordinates for each hub.')).toBeVisible();
  });

  test('adds client hubs inline, then deploys a vehicle and creates ops tasks', async ({ page }) => {
    await mockUiApis(page, []);
    await page.goto('/');
    await page.getByRole('button', { name: 'Operations' }).click();
    await page.getByRole('button', { name: 'Deploy vehicle' }).click();
    await page.getByRole('button', { name: 'Add client' }).click();

    await page.getByLabel('GST number').fill('GST-2');
    await page.getByLabel('Client name').fill('Acme Logistics');
    await page.getByLabel('POC name').fill('UAT Owner');
    await page.getByLabel('POC email').fill('uat.owner@example.com');
    await page.getByLabel('POC phone').fill('+91 99999 11111');
    await page.getByLabel('Hub name').fill('Delhi Hub');
    await page.getByLabel('Google Maps link').fill('https://www.google.com/maps/@28.6139,77.2090,17z');
    const addClientModal = page.locator('.modal-card', { has: page.getByRole('heading', { name: 'Add Client' }) });
    await addClientModal.locator('button[type=\"submit\"]').click();
    await expect(page.getByText('Client saved for reuse.')).toBeVisible();

    const deployModal = page.locator('.modal-card', { has: page.getByRole('heading', { name: 'Deploy Vehicle' }) });
    await expect(deployModal).toBeVisible();
    await deployModal.getByRole('button', { name: 'HR55AY2609' }).click();
    await deployModal.getByLabel('Client').selectOption('Acme Logistics');
    await deployModal.getByLabel('Hub').selectOption('Delhi Hub');
    await deployModal.getByLabel('Parking').selectOption('Gate A Parking');
    await deployModal.getByRole('button', { name: 'Save deployment' }).click();

    await expect(page.getByText('Existing Sheet vehicle assigned to client hub.')).toBeVisible();
    await expect(page.getByText('Park vehicle at assigned parking')).toBeVisible();
    await page.getByRole('button', { name: 'Mark done' }).first().click();
    await expect(page.getByText('Task marked done with completion timestamp.')).toBeVisible();
  });

  test('ending a deployment creates an undeploy task', async ({ page }) => {
    const deployedFleet = {
      ...fleetPayload,
      vehicles: [
        {
          ...fleetPayload.vehicles[0],
          client: 'Acme Logistics',
          hub: 'Delhi Hub',
          parking: 'Gate A Parking',
          hubGmpLink: 'https://www.google.com/maps/@28.6139,77.2090,17z',
          parkingGmpLink: 'https://www.google.com/maps/@28.6139,77.2090,18z',
        },
      ],
    };
    await mockUiApis(page, mappedClients, { fleet: deployedFleet });
    await page.route('**/api/fleet', async (route) => {
      await route.fulfill({ json: deployedFleet });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Operations' }).click();
    await page.getByRole('button', { name: 'End' }).click();
    await expect(page.getByRole('heading', { name: 'End Deployment' })).toBeVisible();
    await page.getByLabel('Reason').fill('Returned to base');
    await page.getByRole('button', { name: 'Schedule undeploy' }).click();
    await expect(page.getByText('Undeploy vehicle and park at')).toBeVisible();
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

test.describe('UAT gate: client live links', () => {
  test('shared client page renders only the vehicles returned for that portal', async ({ page }) => {
    const portal = { portalId: 'uat-portal-1', label: 'Acme dispatch live', client: 'Acme Logistics', active: true, allowed: true };
    await page.route('**/api/client-portals/access?**', async (route) => {
      await route.fulfill({ json: { portal } });
    });
    await page.route('**/api/client-portals/me?**', async (route) => {
      await route.fulfill({ json: { portal, user: { name: 'dispatch@acme.example', email: 'dispatch@acme.example', role: 'client', client: 'Acme Logistics', permissions: ['fleet', 'reports'], portalId: portal.portalId } } });
    });
    await page.route('**/api/client-portals/fleet?**', async (route) => {
      await route.fulfill({ json: { portal, vehicles: [{ ...fleetPayload.vehicles[0], client: 'Acme Logistics', hub: 'Delhi Hub', parking: 'Gate A Parking' }], updatedAt: new Date().toISOString() } });
    });
    await page.goto('/?portal=uat-token-1');
    await expect(page.getByRole('heading', { name: 'Acme dispatch live' })).toBeVisible();
    await expect(page.getByText('HR55AY2609')).toBeVisible();
    await expect(page.getByText('DL51EV1938')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Operations' })).toHaveCount(0);
  });
});

test.describe('UAT gate: drivers and parking CRUD', () => {
  test('adds a driver and edits their contact number', async ({ page }) => {
    await mockUiApis(page, mappedClients, { drivers: [] });
    await page.goto('/');
    await page.getByRole('button', { name: 'Drivers' }).click();
    await page.getByRole('button', { name: 'Add Driver' }).click();
    const addDriverModal = page.locator('.modal-card', { has: page.getByRole('heading', { name: 'Add Driver' }) });
    await addDriverModal.getByLabel('Driver name').fill('Alice Driver');
    await addDriverModal.getByLabel('Contact number').fill('+91 88888 77777');
    await addDriverModal.getByLabel('Driver license number').fill('DL-TEST-1');
    await addDriverModal.getByLabel('Date of birth').fill('1991-02-03');
    await addDriverModal.getByLabel('Email ID').fill('alice@example.com');
    await addDriverModal.locator('button[type=\"submit\"]').click();
    await expect(page.getByText('Alice Driver')).toBeVisible();
    // Close the modal explicitly (some browsers keep it open if native validation blocks submit).
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByTitle('Edit contact number').click();
    await expect(page.getByRole('heading', { name: 'Edit Driver' })).toBeVisible();
    await page.getByLabel('Contact number').fill('+91 77777 66666');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Driver contact updated.')).toBeVisible();
    await expect(page.getByText('+91 77777 66666')).toBeVisible();
  });

  test('adds a parking site and shows parked vehicle count', async ({ page }) => {
    await mockUiApis(page, mappedClients, { parkings: [] });
    await page.goto('/');
    await page.getByRole('button', { name: 'Parking' }).click();
    await page.getByRole('button', { name: 'Add Parking' }).click();
    await page.getByLabel('Parking name').fill('UAT Parking 1');
    await page.getByLabel('Location').fill('Noida');
    await page.getByLabel('Google Maps link').fill('https://www.google.com/maps/@28.6139,77.2090,18z');
    await page.getByRole('button', { name: 'Add Parking' }).last().click();
    await expect(page.getByText('Parking added.')).toBeVisible();
    await expect(page.getByText('UAT Parking 1')).toBeVisible();
    await expect(page.getByRole('cell', { name: '1', exact: true })).toBeVisible();
  });
});

test.describe('UAT gate: EV Fleet filters and reverse geocode', () => {
  test('supports multi-select filters and shows Near place label', async ({ page }) => {
    const richerFleet = {
      sheetTitle: 'Final Detailed Vehicle Snapshots',
      vehicles: [
        { ...fleetPayload.vehicles[0], id: 'HR55AY2609', client: 'Acme Logistics', status: 'Running', model: 'Storm', lat: 28.6139, lng: 77.209 },
        { ...fleetPayload.vehicles[1], id: 'DL51EV1938', client: 'Beta Logistics', status: 'Idle', model: 'Hiload', lat: 28.6139, lng: 77.209 },
        { ...fleetPayload.vehicles[1], id: 'TN01EV0001', client: 'Acme Logistics', status: 'Offline', model: 'Hiload', lat: 28.6139, lng: 77.209 },
      ],
    };
    await mockUiApis(page, mappedClients, { fleet: richerFleet });
    await page.goto('/');
    await page.getByRole('button', { name: 'EV Fleet' }).click();

    await page.getByRole('button', { name: 'Offline' }).click();
    await page.getByRole('button', { name: /Filters/ }).click();
    const popover = page.locator('.filter-popover');
    await expect(popover).toBeVisible();
    await popover.getByText('Acme Logistics').click();
    await popover.getByText('Hiload').click();
    await popover.getByText('Offline').click();

    const vehicleList = page.locator('aside.vehicle-list');
    await expect(vehicleList.getByRole('button', { name: /TN01EV0001/i })).toBeVisible();
    await expect(vehicleList.getByRole('button', { name: /HR55AY2609/i })).toHaveCount(0);

    await vehicleList.getByRole('button', { name: /TN01EV0001/i }).click();
    await expect(page.getByText('Current location: Near UAT Landmark')).toBeVisible();
  });
});
