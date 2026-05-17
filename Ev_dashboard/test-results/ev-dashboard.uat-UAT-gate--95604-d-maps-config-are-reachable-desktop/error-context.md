# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ev-dashboard.uat.spec.js >> UAT gate: real backend readiness >> vehicle sheet and maps config are reachable
- Location: tests\uat\ev-dashboard.uat.spec.js:178:3

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  86  |   });
  87  |   await page.route('**/api/client-hubs', async (route) => {
  88  |     if (route.request().method() === 'POST') {
  89  |       const body = JSON.parse(route.request().postData() || '{}');
  90  |       const hubs = String(body.hubs || '')
  91  |         .split(/\r?\n/)
  92  |         .map((line) => {
  93  |           const [name = '', ...linkParts] = line.trim().split('|');
  94  |           return { name: name.trim(), gmpLink: linkParts.join('|').trim(), lat: 28.6139, lng: 77.2090 };
  95  |         })
  96  |         .filter((hub) => hub.name && hub.gmpLink);
  97  |       clients = [{ client: body.client, hubs }];
  98  |       await route.fulfill({ json: { ok: true, clients } });
  99  |       return;
  100 |     }
  101 |     await route.fulfill({ json: { clients } });
  102 |   });
  103 |   await page.route('**/api/deployments', async (route) => {
  104 |     if (route.request().method() === 'POST') {
  105 |       const body = JSON.parse(route.request().postData() || '{}');
  106 |       const task = {
  107 |         id: 'uat-task-1',
  108 |         title: 'Park vehicle at assigned parking',
  109 |         vehicle: body.vehicle,
  110 |         client: body.client,
  111 |         hub: body.hub,
  112 |         parking: body.parking,
  113 |         poc: body.poc,
  114 |         due: 'Deployment start time',
  115 |         reason: body.usage,
  116 |         status: 'Pending',
  117 |       };
  118 |       tasks = [task, ...tasks];
  119 |       await route.fulfill({ json: { ok: true, deployment: body, task } });
  120 |       return;
  121 |     }
  122 |     await route.fulfill({ json: { deployments: [] } });
  123 |   });
  124 |   await page.route('**/api/driver-assignments', async (route) => {
  125 |     if (route.request().method() === 'POST') {
  126 |       const body = JSON.parse(route.request().postData() || '{}');
  127 |       const assignment = {
  128 |         assignmentId: 'uat-assignment-1',
  129 |         name: body.name,
  130 |         email: body.email,
  131 |         vehicle: body.vehicle,
  132 |         client: body.client,
  133 |         hub: body.hub,
  134 |         date: body.date,
  135 |         shift: `${body.date} - ${body.shift}`,
  136 |         rawShift: body.shift,
  137 |         status: 'Assigned',
  138 |         sessionState: 'Ready',
  139 |       };
  140 |       assignments = [assignment, ...assignments];
  141 |       await route.fulfill({ json: { ok: true, assignment } });
  142 |       return;
  143 |     }
  144 |     await route.fulfill({ json: { assignments } });
  145 |   });
  146 |   await page.route('**/api/driver-session', async (route) => {
  147 |     if (options.failDriverSession) {
  148 |       await route.fulfill({ status: 500, json: { error: 'Unable to update driver session' } });
  149 |       return;
  150 |     }
  151 |     const body = JSON.parse(route.request().postData() || '{}');
  152 |     assignments = assignments.map((assignment) => (
  153 |       assignment.assignmentId === body.assignmentId
  154 |         ? { ...assignment, sessionState: body.state, status: body.state === 'Active session' ? 'Started' : 'Completed' }
  155 |         : assignment
  156 |     ));
  157 |     await route.fulfill({ json: { ok: true, assignment: assignments.find((assignment) => assignment.assignmentId === body.assignmentId) } });
  158 |   });
  159 |   await page.route('**/api/tasks/*/done', async (route) => {
  160 |     const taskId = route.request().url().split('/api/tasks/')[1].split('/done')[0];
  161 |     tasks = tasks.map((task) => (task.id === taskId ? { ...task, status: 'Done' } : task));
  162 |     await route.fulfill({ json: { ok: true, task: tasks.find((task) => task.id === taskId) } });
  163 |   });
  164 |   await page.route('**/api/tasks', async (route) => {
  165 |     await route.fulfill({ json: { tasks } });
  166 |   });
  167 |   await page.route('**/api/settings', async (route) => {
  168 |     if (route.request().method() === 'POST') {
  169 |       settings = JSON.parse(route.request().postData() || '{}');
  170 |       await route.fulfill({ json: { ok: true, settings } });
  171 |       return;
  172 |     }
  173 |     await route.fulfill({ json: { settings } });
  174 |   });
  175 | }
  176 | 
  177 | test.describe('UAT gate: real backend readiness', () => {
  178 |   test('vehicle sheet and maps config are reachable', async ({ request }, testInfo) => {
  179 |     test.skip(testInfo.project.name !== 'desktop', 'API readiness only needs one pass');
  180 | 
  181 |     let fleet = await request.get(`${apiBaseUrl}/api/fleet`);
  182 |     if (fleet.status() === 401) {
  183 |       const email = process.env.DEFAULT_ADMIN_EMAIL;
  184 |       expect(email, 'DEFAULT_ADMIN_EMAIL is required when AUTH_REQUIRED=true').toBeTruthy();
  185 |       const otpRequest = await request.post(`${apiBaseUrl}/api/auth/request-otp`, { data: { email } });
> 186 |       expect(otpRequest.ok()).toBeTruthy();
      |                               ^ Error: expect(received).toBeTruthy()
  187 |       const otpPayload = await otpRequest.json();
  188 |       expect(otpPayload.devOtp, 'OTP_DEV_MODE=true is required for automated UAT auth').toBeTruthy();
  189 |       const verify = await request.post(`${apiBaseUrl}/api/auth/verify-otp`, { data: { email, otp: otpPayload.devOtp } });
  190 |       expect(verify.ok()).toBeTruthy();
  191 |       fleet = await request.get(`${apiBaseUrl}/api/fleet`);
  192 |     }
  193 |     expect(fleet.ok()).toBeTruthy();
  194 |     const fleetJson = await fleet.json();
  195 |     expect(fleetJson.sheetTitle).toBe('Final Detailed Vehicle Snapshots');
  196 |     expect(fleetJson.vehicles.length).toBeGreaterThan(0);
  197 | 
  198 |     const config = await request.get(`${apiBaseUrl}/api/config`);
  199 |     expect(config.ok()).toBeTruthy();
  200 |     const configJson = await config.json();
  201 |     expect(configJson.googleMaps.enabled).toBeTruthy();
  202 |   });
  203 | });
  204 | 
  205 | test.describe('UAT gate: operations flow permutations', () => {
  206 |   test('blocks deployment until a client has at least one mapped hub', async ({ page }) => {
  207 |     await mockUiApis(page, []);
  208 |     await page.goto('/');
  209 |     await page.getByRole('button', { name: 'Operations' }).click();
  210 | 
  211 |     await expect(page.getByText('Add a client with at least one mapped hub before deployment.')).toBeVisible();
  212 |     await expect(page.getByRole('button', { name: 'Save Deployment' })).toBeDisabled();
  213 |   });
  214 | 
  215 |   test('rejects client onboarding when hub Google Maps link is missing', async ({ page }) => {
  216 |     await mockUiApis(page, []);
  217 |     await page.goto('/');
  218 |     await page.getByRole('button', { name: 'Operations' }).click();
  219 | 
  220 |     await page.getByLabel('Client').last().fill('Acme Logistics');
  221 |     await page.getByLabel('Hubs + Google Maps links').fill('Delhi Hub');
  222 |     await page.getByRole('button', { name: 'Save Client For Reuse' }).click();
  223 | 
  224 |     await expect(page.getByText('Each hub needs a name and Google Maps link.')).toBeVisible();
  225 |   });
  226 | 
  227 |   test('adds client hubs inline, then deploys an existing Sheet vehicle to hub and parking', async ({ page }) => {
  228 |     await mockUiApis(page, []);
  229 |     await page.goto('/');
  230 |     await page.getByRole('button', { name: 'Operations' }).click();
  231 | 
  232 |     await page.getByLabel('Client').last().fill('Acme Logistics');
  233 |     await page.getByLabel('Hubs + Google Maps links').fill('Delhi Hub | https://www.google.com/maps/@28.6139,77.2090,17z');
  234 |     await page.getByRole('button', { name: 'Save Client For Reuse' }).click();
  235 |     await expect(page.getByText('Client hubs saved to Google Sheets.')).toBeVisible();
  236 | 
  237 |     const deploymentForm = page.locator('form.ops-form').filter({ hasText: 'Deploy Vehicle To Client' });
  238 |     await deploymentForm.locator('select[name="vehicle"]').selectOption('HR55AY2609');
  239 |     await deploymentForm.locator('select[name="client"]').selectOption('Acme Logistics');
  240 |     await deploymentForm.locator('select[name="hub"]').selectOption('Delhi Hub');
  241 |     await deploymentForm.locator('input[name="parking"]').fill('Gate A Parking');
  242 |     await deploymentForm.locator('input[name="parkingGmpLink"]').fill('https://www.google.com/maps/@28.6139,77.2090,18z');
  243 |     await deploymentForm.locator('input[name="poc"]').fill('UAT Owner');
  244 |     await page.getByRole('button', { name: 'Save Deployment' }).click();
  245 | 
  246 |     await expect(page.getByText('Existing Sheet vehicle assigned to client hub.')).toBeVisible();
  247 |     await expect(page.getByText('Park vehicle at assigned parking')).toBeVisible();
  248 |     await page.getByRole('button', { name: 'Mark done' }).click();
  249 |     await expect(page.getByText('Task marked done with completion timestamp.')).toBeVisible();
  250 |     await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled();
  251 |     await page.getByRole('button', { name: 'EV Fleet' }).click();
  252 |     await expect(page.getByText('Place status: Inside parking')).toBeVisible();
  253 |   });
  254 | 
  255 |   test('driver assignment updates fleet and reports controls remain usable', async ({ page }) => {
  256 |     await mockUiApis(page, mappedClients);
  257 |     await page.goto('/');
  258 |     await page.getByRole('button', { name: 'Operations' }).click();
  259 | 
  260 |     await page.getByLabel('Driver').fill('UAT Driver');
  261 |     await page.getByLabel('Login email').fill('uat.driver@example.com');
  262 |     await page.getByLabel('Vehicle').last().selectOption('DL51EV1938');
  263 |     await page.getByLabel('Date').fill('2026-05-11');
  264 |     await page.getByLabel('Shift').fill('9:00 AM - 6:00 PM');
  265 |     await page.getByRole('button', { name: 'Assign Driver' }).click();
  266 |     await expect(page.getByText('Driver assignment saved. Driver can now start the session.')).toBeVisible();
  267 | 
  268 |     await page.getByRole('button', { name: 'EV Fleet' }).click();
  269 |     await page.getByPlaceholder('Search...').fill('DL51EV1938');
  270 |     await expect(page.getByText('Assigned driver today')).toBeVisible();
  271 |     await expect(page.getByText('UAT Driver')).toBeVisible();
  272 | 
  273 |     await page.getByRole('button', { name: 'Reports' }).click();
  274 |     await expect(page.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
  275 |   });
  276 | 
  277 |   test('driver session does not move locally when backend rejects it', async ({ page }) => {
  278 |     await mockUiApis(page, mappedClients, { failDriverSession: true });
  279 |     await page.goto('/');
  280 |     await page.getByRole('button', { name: 'Operations' }).click();
  281 | 
  282 |     await page.getByLabel('Driver').fill('UAT Driver');
  283 |     await page.getByLabel('Login email').fill('uat.driver@example.com');
  284 |     await page.getByLabel('Vehicle').last().selectOption('DL51EV1938');
  285 |     await page.getByLabel('Date').fill('2026-05-11');
  286 |     await page.getByLabel('Shift').fill('9:00 AM - 6:00 PM');
```