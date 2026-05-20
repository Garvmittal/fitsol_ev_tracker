import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BatteryCharging,
  Calendar,
  CalendarDays,
  Car,
  Check,
  CircleAlert,
  Download,
  ExternalLink,
  Filter,
  FileSpreadsheet,
  Gauge,
  IdCard,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Navigation,
  ParkingCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Route,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Truck,
  UserRound,
  UsersRound,
  X,
  Zap,
} from 'lucide-react';
import './styles.css';
import { supabaseApiJson, supabaseDirectEnabled } from './supabaseApi.js';

const assumedAverageSpeedKmph = 24;

const vehiclesSeed = [
  {
    id: 'TN77T5990',
    client: 'Craftsman Automation Limited',
    hub: 'Sandhar, Hosur',
    parking: 'Hosur Charging Parking',
    status: 'Running',
    battery: 84,
    distance: 27,
    todayDistance: 64,
    runningTime: '3h 12m',
    avgSpeed: '20 km/h',
    temp: '31 C',
    odometer: '42,180 km',
    energy: '21.4 kWh',
    eta: '1:51 PM',
    etaDate: '06-05-2026',
    lastUpdated: 'less than a minute ago',
    driverState: 'active',
    driver: 'Garv Sharma',
    driverMeta: 'Confirmed by scan at 11:53 AM',
    route: 'Craftsman, Shoolagiri to Sandhar, Hosur',
    location: 'NH 44 service road, Krishnagiri',
    lastStop: 'Sandhar gate parking',
    carbon: '38.2 kgCO2e',
    confidence: 'Verified',
    lat: 12.736,
    lng: 77.829,
    x: 55,
    y: 59,
  },
  {
    id: 'KA05EV7781',
    client: 'JBM Logistics',
    hub: 'Peenya Hub',
    parking: 'Warehouse Dock P2',
    status: 'Charging',
    battery: 91,
    distance: 4,
    todayDistance: 12,
    runningTime: '42m',
    avgSpeed: '17 km/h',
    temp: '29 C',
    odometer: '18,920 km',
    energy: '9.7 kWh',
    eta: '2:20 PM',
    etaDate: '06-05-2026',
    lastUpdated: '4 minutes ago',
    driverState: 'assigned',
    driver: 'Rajesh Kumar',
    driverMeta: 'Not yet confirmed by scan/input',
    route: 'Peenya Hub to JBM Dock 4',
    location: 'Peenya Industrial Area',
    lastStop: 'JBM dock 4',
    carbon: '11.5 kgCO2e',
    confidence: 'Estimated',
    lat: 13.03,
    lng: 77.515,
    x: 49,
    y: 71,
  },
  {
    id: 'HR55AY2609',
    client: 'Flipkart',
    hub: 'Bilaspur Sort Center',
    parking: 'North Yard Parking',
    status: 'Idle',
    battery: 76,
    distance: 1,
    todayDistance: 0.7,
    runningTime: '4m',
    avgSpeed: 'Unavailable',
    temp: '33 C',
    odometer: '61,304 km',
    energy: 'Unavailable',
    eta: '3:05 PM',
    etaDate: '06-05-2026',
    lastUpdated: '12 minutes ago',
    driverState: 'last',
    driver: 'Mohan Singh',
    driverMeta: 'Last confirmed 05 May, 7:22 PM',
    route: 'Bilaspur Sort Center to North Yard',
    location: 'Bilaspur logistics park',
    lastStop: 'North Yard charging bay',
    carbon: 'Needs Review',
    confidence: 'Needs Review',
    lat: 28.322,
    lng: 76.907,
    x: 48,
    y: 41,
  },
  {
    id: 'DL01EV4420',
    client: 'CEAT',
    hub: 'Bhiwandi Hub',
    parking: 'Charging Zone A',
    status: 'Offline',
    battery: 43,
    distance: 0,
    todayDistance: 0,
    runningTime: 'Unavailable',
    avgSpeed: 'Unavailable',
    temp: 'Unavailable',
    odometer: '30,110 km',
    energy: 'Unavailable',
    eta: 'Unavailable',
    etaDate: '06-05-2026',
    lastUpdated: '2 hours ago',
    driverState: 'none',
    driver: 'No driver confirmed yet',
    driverMeta: 'No assignment for today',
    route: 'Bhiwandi Hub local movement',
    location: 'Last seen near Bhiwandi',
    lastStop: 'CEAT loading gate',
    carbon: 'Unavailable',
    confidence: 'Unavailable',
    lat: 19.281,
    lng: 73.048,
    x: 37,
    y: 66,
  },
];

const initialTasks = [
  {
    id: 1,
    title: 'Park vehicle at assigned parking',
    vehicle: 'TN77T5990',
    client: 'Craftsman Automation Limited',
    hub: 'Sandhar, Hosur',
    parking: 'Hosur Charging Parking',
    poc: 'Garv Sharma',
    due: 'Today, 1:30 PM',
    reason: 'New deployment',
    status: 'Pending',
  },
  {
    id: 2,
    title: 'Check why vehicle did not move',
    vehicle: 'HR55AY2609',
    client: 'Flipkart',
    hub: 'Bilaspur Sort Center',
    parking: 'North Yard Parking',
    poc: 'Amit Ops',
    due: 'Today, 5:00 PM',
    reason: 'Charged but unused',
    status: 'Pending',
  },
  {
    id: 3,
    title: 'Transfer vehicle to new client hub',
    vehicle: 'DL01EV4420',
    client: 'CEAT',
    hub: 'Bhiwandi Hub',
    parking: 'Charging Zone A',
    poc: 'Neha Admin',
    due: 'Tomorrow, 10:00 AM',
    reason: 'Scheduled transfer',
    status: 'Pending',
  },
];

const driverSeed = [
  { name: 'Garv Sharma', email: 'garv@fitsol.green', vehicle: 'TN77T5990', status: 'Started', shift: '11:30 AM - 7:30 PM' },
  { name: 'Rajesh Kumar', email: 'rajesh@fitsol.green', vehicle: 'KA05EV7781', status: 'Assigned', shift: '2:00 PM - 10:00 PM' },
  { name: 'Mohan Singh', email: 'mohan@fitsol.green', vehicle: 'HR55AY2609', status: 'Completed', shift: 'Yesterday' },
];

const clientHubSeed = [];

const tabPermissions = {
  Overview: 'fleet',
  'EV Fleet': 'fleet',
  Clients: 'deployments',
  Parking: 'deployments',
  Drivers: 'drivers',
  Driver: 'driver',
  Operations: ['deployments', 'drivers', 'tasks'],
  Admin: ['alerts', 'all'],
};

const primaryTabs = ['Overview', 'EV Fleet', 'Clients', 'Drivers', 'Parking', 'Operations', 'Admin'];

function App() {
  const [activeTab, setActiveTab] = useState('EV Fleet');
  const [vehicles, setVehicles] = useState(vehiclesSeed);
  const [dataSourceStatus, setDataSourceStatus] = useState('Using demo data. Configure production Sheet/API endpoint to load live fleet telemetry.');
  const [selectedId, setSelectedId] = useState('TN77T5990');
  const [tasks, setTasks] = useState(initialTasks);
  const [driverAssignments, setDriverAssignments] = useState(driverSeed);
  const [clientHubs, setClientHubs] = useState(clientHubSeed);
  const [drivers, setDrivers] = useState([]);
  const initialParkingSeed = (() => {
    const names = Array.from(new Set(vehiclesSeed.map((v) => v.parking).filter(Boolean)));
    return names.map((name, idx) => ({ id: `P${idx + 1}`, name, location: '', gmpLink: '', lat: undefined, lng: undefined }));
  })();
  const [parkings, setParkings] = useState(initialParkingSeed);
  const [driverSession, setDriverSession] = useState('Ready');
  const [settingsState, setSettingsState] = useState({
    goodCharge: 70,
    minDistance: 10,
    minRunTime: 10,
    electricityFactor: 0.72,
    cngFactor: 2.75,
    cngConsumption: 0.18,
    evEnergy: 0.22,
  });
  const [statusFilter, setStatusFilter] = useState('Active');
  const [fleetFilters, setFleetFilters] = useState({ clients: [], models: [], statuses: [] });
  const [query, setQuery] = useState('');
  const [range, setRange] = useState({ from: '2026-04-29', to: '2026-05-06' });
  const [rangeError, setRangeError] = useState('');
  const [toast, setToast] = useState('');
  const [auth, setAuth] = useState({ user: null, authRequired: true, loading: true });
  const [mapConfig, setMapConfig] = useState({ enabled: false, apiKey: '', mapId: '', missing: { apiKey: true, mapId: true } });
  const [loginEmail, setLoginEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');

  async function reloadParkingSites() {
    try {
      const payload = await apiJson('/api/parking-sites');
      if (payload.parkings) setParkings(payload.parkings);
    } catch {
      // ignore
    }
  }

  async function addParkingSite({ name, location, gmpLink }) {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) return { ok: false, error: 'Parking name is required.' };
    try {
      const payload = await apiJson('/api/parking-sites', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          location: String(location || '').trim(),
          gmpLink: String(gmpLink || '').trim(),
        }),
      });
      if (payload.parkings) setParkings(payload.parkings);
      setToast('Parking added.');
      window.setTimeout(() => setToast(''), 2400);
      return { ok: true, error: '' };
    } catch (error) {
      const message = error.message || 'Unable to add parking.';
      setToast(message);
      window.setTimeout(() => setToast(''), 2600);
      return { ok: false, error: message };
    }
  }

  // Compatibility: keep the legacy Operations helpers that expect `addParking`.
  function addParking({ name, gmpLink }) {
    addParkingSite({ name, location: '', gmpLink });
  }

  useEffect(() => {
    if (auth.loading || !auth.user || !canAccess(auth.user, 'fleet')) return undefined;
    let cancelled = false;
    loadProductionVehicles()
      .then((liveVehicles) => {
        if (cancelled || liveVehicles.length === 0) return;
        setVehicles(liveVehicles);
        setSelectedId(liveVehicles[0].id);
        setDataSourceStatus(`Loaded ${liveVehicles.length} vehicles from production data source.`);
      })
      .catch((error) => {
        if (!cancelled) {
          setDataSourceStatus(`Using demo data. Live data source unavailable: ${error.message}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auth.loading, auth.user]);

  useEffect(() => {
    apiJson('/api/auth/me')
      .then((payload) => setAuth({ user: payload.user, authRequired: payload.authRequired, loading: false }))
      .catch(() => setAuth({ user: null, authRequired: true, loading: false }));
  }, []);

  useEffect(() => {
    apiJson('/api/config')
      .then((payload) => setMapConfig(payload.googleMaps || { enabled: false, apiKey: '', mapId: '', missing: { apiKey: true, mapId: true } }))
      .catch(() => setMapConfig({ enabled: false, apiKey: '', mapId: '', missing: { apiKey: true, mapId: true } }));
  }, []);

  useEffect(() => {
    if (auth.loading || !auth.user || !canAccess(auth.user, 'fleet')) return;
    apiJson('/api/client-hubs')
      .then((payload) => {
        if (payload.clients?.length) setClientHubs(payload.clients);
      })
      .catch(() => {});
  }, [auth.loading, auth.user]);

  const visibleTabs = useMemo(() => primaryTabs.filter((tab) => canAccess(auth.user, tabPermissions[tab])), [auth.user]);
  const modelOptions = useMemo(() => uniqueOptions(vehicles.map(modelLabelFor)), [vehicles]);
  const vehicleStatusOptions = useMemo(() => uniqueOptions(vehicles.map((vehicle) => vehicle.status)), [vehicles]);
  const clientOptions = useMemo(() => uniqueOptions(vehicles.map((vehicle) => normalizeClientName(vehicle.client)).filter(Boolean)), [vehicles]);
  const activeVehicleCount = vehicles.filter((vehicle) => vehicle.status !== 'Offline').length;
  const offlineVehicleCount = vehicles.filter((vehicle) => vehicle.status === 'Offline').length;
  const driverContactByVehicle = useMemo(() => {
    const map = new Map();
    (driverAssignments || []).forEach((assignment) => {
      if (!isCurrentDriverAssignment(assignment)) return;
      const vehicle = String(assignment.vehicle || '').trim().toUpperCase();
      if (!vehicle) return;
      map.set(vehicle, { name: assignment.name || '', email: assignment.email || '' });
    });
    return map;
  }, [driverAssignments]);

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0]);
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (auth.loading || !auth.user) return;
    if (canAccess(auth.user, 'tasks')) {
      apiJson('/api/tasks').then((payload) => setTasks(payload.tasks || [])).catch(() => {});
    }
	    if (canAccess(auth.user, ['drivers', 'driver'])) {
	      apiJson('/api/driver-assignments').then((payload) => {
	        setDriverAssignments(payload.assignments || []);
	        if (payload.assignments?.[0]?.sessionState) setDriverSession(payload.assignments[0].sessionState);
	      }).catch(() => {});
	    }
	    if (canAccess(auth.user, 'drivers')) {
	      apiJson('/api/drivers').then((payload) => setDrivers(payload.drivers || [])).catch(() => {});
	    }
	    if (canAccess(auth.user, 'deployments')) {
	      apiJson('/api/parking-sites').then((payload) => payload.parkings && setParkings(payload.parkings)).catch(() => {});
	    }
	    if (canAccess(auth.user, 'reports')) {
	      apiJson('/api/settings').then((payload) => payload.settings && setSettingsState(payload.settings)).catch(() => {});
	    }
	  }, [auth.loading, auth.user]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const matchesQuery = [vehicle.id, vehicle.client, vehicle.hub, vehicle.driver]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatusGroup = statusFilter === 'Offline' ? vehicle.status === 'Offline' : vehicle.status !== 'Offline';
      const matchesVehicleStatus = !fleetFilters.statuses.length || fleetFilters.statuses.includes(vehicle.status);
      const matchesModel = !fleetFilters.models.length || fleetFilters.models.includes(modelLabelFor(vehicle));
      const matchesClient = !fleetFilters.clients.length || fleetFilters.clients.includes(normalizeClientName(vehicle.client));
      return matchesQuery && matchesStatusGroup && matchesVehicleStatus && matchesModel && matchesClient;
    });
  }, [vehicles, query, statusFilter, fleetFilters]);

  const mapFiltersActive = Boolean(
    query.trim()
    || statusFilter === 'Offline'
    || fleetFilters.clients.length
    || fleetFilters.models.length
    || fleetFilters.statuses.length
  );
  const mapClientHubs = useMemo(() => {
    if (!mapFiltersActive) return [];
    const clientNames = new Set(
      (fleetFilters.clients.length
        ? fleetFilters.clients
        : filteredVehicles.map((vehicle) => normalizeClientName(vehicle.client)))
        .filter(Boolean),
    );
    return clientHubs.filter((client) => clientNames.has(normalizeClientName(client.client)));
  }, [clientHubs, filteredVehicles, fleetFilters.clients, mapFiltersActive]);
  const mapParkings = useMemo(() => {
    if (!mapFiltersActive) return parkings;
    const parkingNames = new Set(filteredVehicles.map((vehicle) => normalizeMapScopeName(vehicle.parking)).filter(Boolean));
    if (!parkingNames.size) return [];
    return parkings.filter((parking) => parkingNames.has(normalizeMapScopeName(parking.name)));
  }, [parkings, filteredVehicles, mapFiltersActive]);
  const selected = filteredVehicles.find((vehicle) => vehicle.id === selectedId) || filteredVehicles[0] || null;

  useEffect(() => {
    if (filteredVehicles.length && !filteredVehicles.some((vehicle) => vehicle.id === selectedId)) {
      setSelectedId(filteredVehicles[0].id);
    }
  }, [filteredVehicles, selectedId]);

  function validateRange(nextRange) {
    setRange(nextRange);
    const start = new Date(nextRange.from);
    const end = new Date(nextRange.to);
    const days = (end - start) / 86400000;
    setRangeError(days > 35 ? 'Please select a date range of 35 days or less.' : '');
  }

  async function markTaskDone(taskId) {
    try {
      const payload = await apiJson(`/api/tasks/${encodeURIComponent(taskId)}/done`, { method: 'POST' });
      setTasks((current) => current.map((task) => (task.id === taskId ? payload.task : task)));
      setToast('Task marked done with completion timestamp.');
    } catch (error) {
      setToast(error.message || 'Unable to complete task.');
    }
    window.setTimeout(() => setToast(''), 2400);
  }

  async function addClient(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const client = String(form.get('client') || '').trim();
    const gstNumber = String(form.get('gstNumber') || '').trim();
    const clientPoc = String(form.get('clientPoc') || '').trim();
    const hubs = parseLocationLines(form.get('hubs'));
    const parkings = parseLocationLines(form.get('parkings'));
    if (!client || !gstNumber || !clientPoc) {
      setToast('Add client name, GST number, and client POC.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    if (!hubs.length) {
      setToast('Add at least one hub.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    if (hubs.some((hub) => !hub.name || !hub.gmpLink)) {
      setToast('Each hub needs a name and Google Maps link.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    if (parkings.some((parking) => !parking.name || !parking.gmpLink)) {
      setToast('Each parking point needs a name and Google Maps link.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    if (hubs.some((hub) => !mapLinkInfo(hub.gmpLink).valid)) {
      setToast('Use valid Google Maps links with coordinates for each hub.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    if (parkings.some((parking) => !mapLinkInfo(parking.gmpLink).valid)) {
      setToast('Use valid Google Maps links with coordinates for each parking point.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    try {
      const payload = await apiJson('/api/client-hubs', {
        method: 'POST',
        body: JSON.stringify({
          client,
          gstNumber,
          clientPoc,
          hubs: hubs.map((hub) => `${hub.name} | ${hub.gmpLink}`).join('\n'),
          parkings: parkings.map((parking) => `${parking.name} | ${parking.gmpLink}`).join('\n'),
        }),
      });
      setClientHubs(payload.clients || []);
    } catch (error) {
      setToast(error.message || 'Unable to save client hubs.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    formElement.reset();
    setToast('Client saved for reuse.');
    window.setTimeout(() => setToast(''), 2600);
    return true;
  }

  async function reloadClientHubs() {
    try {
      const payload = await apiJson('/api/client-hubs', { method: 'GET' });
      if (payload.clients) setClientHubs(payload.clients);
    } catch (error) {
      // ignore
    }
  }

  async function reloadDrivers() {
    try {
      const payload = await apiJson('/api/drivers', { method: 'GET' });
      if (payload.drivers) setDrivers(payload.drivers);
    } catch (error) {
      // ignore
    }
  }

  async function addDriver(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const licenseNumber = String(form.get('licenseNumber') || '').trim();
    const dob = String(form.get('dob') || '').trim();
    const email = String(form.get('email') || '').trim();

    if (!name || !phone || !licenseNumber || !dob || !email) {
      setToast('Fill name, contact number, license, DOB, and email.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }

    const duplicateMessage = findDuplicateDriverMessage(drivers, { phone, email, licenseNumber });
    if (duplicateMessage) {
      setToast(duplicateMessage);
      window.setTimeout(() => setToast(''), 3000);
      return false;
    }

    try {
      const payload = await apiJson('/api/drivers', {
        method: 'POST',
        body: JSON.stringify({ name, phone, licenseNumber, dob, email }),
      });
      if (payload.drivers) setDrivers(payload.drivers);
      event.currentTarget.reset();
      setToast('Driver added.');
      window.setTimeout(() => setToast(''), 2400);
      return true;
    } catch (error) {
      setToast(error.message || 'Unable to save driver.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
  }

  async function updateDriverPhone(driverId, phone) {
    const duplicatePhone = findDuplicateDriverMessage(drivers, { phone }, driverId);
    if (duplicatePhone) {
      setToast(duplicatePhone);
      window.setTimeout(() => setToast(''), 3000);
      return false;
    }

    try {
      const payload = await apiJson(`/api/drivers/${encodeURIComponent(driverId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ phone }),
      });
      if (payload.drivers) setDrivers(payload.drivers);
      setToast('Driver contact updated.');
      window.setTimeout(() => setToast(''), 2400);
      return true;
    } catch (error) {
      setToast(error.message || 'Unable to update driver.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
  }

  async function addDeployment(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const vehicleId = form.get('vehicle').toString().trim().toUpperCase();
    const existingVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
    if (!existingVehicle) {
      setToast('Choose a vehicle from the live Sheet fleet.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    if (!canScheduleVehicleForDeployment(existingVehicle)) {
      setToast('Vehicle must be offline or already deployed before scheduling.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    const deployment = {
      client: String(form.get('client') || '').trim(),
      hub: String(form.get('hub') || '').trim(),
      hubGmpLink: String(form.get('hubGmpLink') || '').trim(),
      hubLat: Number(form.get('hubLat')),
      hubLng: Number(form.get('hubLng')),
      parking: String(form.get('parking') || '').trim(),
      parkingGmpLink: String(form.get('parkingGmpLink') || '').trim(),
      parkingLat: Number(form.get('parkingLat')),
      parkingLng: Number(form.get('parkingLng')),
      previousUndeployAt: String(form.get('previousUndeployAt') || '').trim(),
      deployAt: String(form.get('deployAt') || '').trim(),
      layoverParking: String(form.get('layoverParking') || '').trim(),
      layoverParkingGmpLink: String(form.get('layoverParkingGmpLink') || '').trim(),
      layoverParkingLat: Number(form.get('layoverParkingLat')),
      layoverParkingLng: Number(form.get('layoverParkingLng')),
      driverEmail: String(form.get('driverEmail') || '').trim(),
      driverName: String(form.get('driverName') || '').trim(),
    };
    const parkingCoords = Number.isFinite(deployment.parkingLat) && Number.isFinite(deployment.parkingLng)
      ? { lat: deployment.parkingLat, lng: deployment.parkingLng }
      : extractMapCoords(deployment.parkingGmpLink);
    const hubCoords = Number.isFinite(deployment.hubLat) && Number.isFinite(deployment.hubLng)
      ? { lat: deployment.hubLat, lng: deployment.hubLng }
      : extractMapCoords(deployment.hubGmpLink);
    const layoverCoords = Number.isFinite(deployment.layoverParkingLat) && Number.isFinite(deployment.layoverParkingLng)
      ? { lat: deployment.layoverParkingLat, lng: deployment.layoverParkingLng }
      : extractMapCoords(deployment.layoverParkingGmpLink);
    if (!deployment.client || !deployment.hub || !hubCoords || !deployment.parking || !parkingCoords || !deployment.deployAt || !deployment.layoverParking || !layoverCoords) {
      setToast('Choose client, hub, parking, deployment date/time, and layover parking.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    deployment.hubLat = hubCoords.lat;
    deployment.hubLng = hubCoords.lng;
    deployment.parkingLat = parkingCoords.lat;
    deployment.parkingLng = parkingCoords.lng;
    deployment.layoverParkingLat = layoverCoords.lat;
    deployment.layoverParkingLng = layoverCoords.lng;
    try {
      const payload = await apiJson('/api/deployments', {
        method: 'POST',
        body: JSON.stringify({
          vehicle: vehicleId,
          client: deployment.client,
          hub: deployment.hub,
          hubGmpLink: deployment.hubGmpLink,
          hubLat: deployment.hubLat,
          hubLng: deployment.hubLng,
          parking: deployment.parking,
          parkingGmpLink: deployment.parkingGmpLink,
          parkingLat: deployment.parkingLat,
          parkingLng: deployment.parkingLng,
          previousUndeployAt: deployment.previousUndeployAt,
          deployAt: deployment.deployAt,
          layoverParking: deployment.layoverParking,
          layoverParkingGmpLink: deployment.layoverParkingGmpLink,
          layoverParkingLat: deployment.layoverParkingLat,
          layoverParkingLng: deployment.layoverParkingLng,
          usage: form.get('usage'),
          poc: form.get('poc'),
          driverEmail: deployment.driverEmail,
          driverName: deployment.driverName,
        }),
      });
      if (payload.tasks?.length) setTasks((current) => [...payload.tasks, ...current]);
      if (payload.assignment?.vehicle) {
        setDriverAssignments((current) => [payload.assignment, ...current]);
      }
      const assignment = payload.assignment || null;
      if (assignment?.name) {
        deployment.driverState = assignment.sessionState === 'Active session' ? 'active' : 'assigned';
        deployment.driver = assignment.name;
        deployment.driverEmail = assignment.email || deployment.driverEmail;
        deployment.driverMeta = `${assignment.status || 'Assigned'} - ${assignment.shift || 'Deployment default'}`;
      }
    } catch (error) {
      setToast(error.message || 'Unable to save deployment.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    setVehicles((current) => current.map((vehicle) => (
      vehicle.id === vehicleId
        ? {
            ...vehicle,
            ...deployment,
            route: `${deployment.hub} deployment route`,
            lastStop: deployment.parking,
            locationState: locationStateFor(vehicle, deployment),
            lastUpdated: 'just now',
          }
        : vehicle
    )));
    setSelectedId(existingVehicle.id);
    formElement.reset();
    setToast('Existing Sheet vehicle assigned to client hub.');
    window.setTimeout(() => setToast(''), 2600);
    return true;
  }

  async function updateDeployment(data) {
    const vehicleId = String(data.vehicle || '').trim().toUpperCase();
    if (!vehicleId || !data.client || !data.hub || !data.parking) {
      setToast('Choose hub, parking, and vehicle.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    try {
      const payload = await apiJson('/api/deployments/update', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const assignment = payload.assignment || null;
      if (assignment?.vehicle) setDriverAssignments((current) => [assignment, ...current]);
      setVehicles((current) => current.map((vehicle) => {
        if (vehicle.id !== vehicleId) return vehicle;
        const next = {
          ...vehicle,
          hub: data.hub,
          hubGmpLink: data.hubGmpLink || '',
          hubLat: data.hubLat,
          hubLng: data.hubLng,
          parking: data.parking,
          parkingGmpLink: data.parkingGmpLink || '',
          parkingLat: data.parkingLat,
          parkingLng: data.parkingLng,
          route: data.hub ? `${data.hub} deployment route` : vehicle.route,
          lastStop: data.parking || vehicle.lastStop,
          lastUpdated: 'just now',
        };
        next.locationState = locationStateFor(next, next);
        if (assignment?.name) {
          next.driverState = assignment.sessionState === 'Active session' ? 'active' : 'assigned';
          next.driver = assignment.name;
          next.driverEmail = assignment.email || '';
          next.driverMeta = `${assignment.status || 'Assigned'} - ${assignment.shift || 'Deployment default'}`;
        }
        return next;
      }));
      setToast('Deployment updated.');
      window.setTimeout(() => setToast(''), 2600);
      return true;
    } catch (error) {
      setToast(error.message || 'Unable to update deployment.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
  }

  async function removeDeployment(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const vehicleId = String(form.get('vehicle') || '').trim().toUpperCase();
    if (!vehicleId) {
      setToast('Choose a deployed vehicle to remove.');
      window.setTimeout(() => setToast(''), 2600);
      return;
    }
    try {
      await apiJson('/api/deployments/remove', {
        method: 'POST',
        body: JSON.stringify({ vehicle: vehicleId, reason: form.get('reason') }),
      });
    } catch (error) {
      setToast(error.message || 'Unable to remove vehicle from client.');
      window.setTimeout(() => setToast(''), 2600);
      return;
    }
    setVehicles((current) => current.map((vehicle) => (
      vehicle.id === vehicleId
        ? {
            ...vehicle,
            client: 'Unassigned client',
            hub: 'Unassigned hub',
            parking: 'Parking unavailable',
            hubGmpLink: '',
            hubLat: undefined,
            hubLng: undefined,
            parkingGmpLink: '',
            parkingLat: undefined,
            parkingLng: undefined,
            driverState: 'none',
            driver: 'No driver confirmed yet',
            driverMeta: 'Driver session not connected',
            locationState: 'Not assigned to a hub/parking geofence',
            lastUpdated: 'just now',
          }
        : vehicle
    )));
    formElement.reset();
    setToast('Vehicle removed from client deployment. Client remains available for reuse.');
    window.setTimeout(() => setToast(''), 2600);
  }

  async function endDeploymentNow(vehicleId, reason = '') {
    if (!vehicleId) return false;
    try {
      await apiJson('/api/deployments/remove', {
        method: 'POST',
        body: JSON.stringify({ vehicle: vehicleId, reason }),
      });
    } catch (error) {
      setToast(error.message || 'Unable to remove vehicle from client.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    setVehicles((current) => current.map((vehicle) => (
      vehicle.id === vehicleId
        ? {
            ...vehicle,
            client: 'Unassigned client',
            hub: 'Unassigned hub',
            parking: 'Parking unavailable',
            hubGmpLink: '',
            hubLat: undefined,
            hubLng: undefined,
            parkingGmpLink: '',
            parkingLat: undefined,
            parkingLng: undefined,
            driverState: 'none',
            driver: 'No driver confirmed yet',
            driverMeta: 'Driver session not connected',
            locationState: 'Not assigned to a hub/parking geofence',
            lastUpdated: 'just now',
          }
        : vehicle
    )));
    setToast('Vehicle removed from client deployment.');
    window.setTimeout(() => setToast(''), 2600);
    return true;
  }

  async function scheduleDeploymentEnd({ vehicle, reason, effectiveAt, parking, driverChoice }) {
    if (!vehicle || !effectiveAt || !parking) return null;
    try {
      const payload = await apiJson('/api/deployments/end', {
        method: 'POST',
        body: JSON.stringify({ vehicle, reason, effectiveAt, parking, driverChoice }),
      });
      if (payload.task) setTasks((current) => [payload.task, ...current]);
      setToast('Undeploy scheduled and task created.');
      window.setTimeout(() => setToast(''), 2400);
      return { vehicle, reason, effectiveAt, parking, driverChoice };
    } catch (error) {
      setToast(error.message || 'Unable to schedule undeploy.');
      window.setTimeout(() => setToast(''), 2600);
      return null;
    }
  }

  function exportReport() {
    const header = ['Vehicle number', 'Client', 'Hub', 'Parking location', 'Latest driver', 'Distance covered', 'Running time', 'Current battery', 'Carbon saved vs CNG', 'Carbon confidence'];
    const rows = vehicles.map((vehicle) => [
      vehicle.id,
      vehicle.client,
      vehicle.hub,
      vehicle.parking,
      vehicle.driver,
      vehicle.todayDistance,
      ensureRunningTime(vehicle.runningTime, vehicle.todayDistance),
      `${vehicle.battery}%`,
      vehicle.carbon,
      vehicle.confidence,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fitsol-client-wise-ev-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function assignDriver(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const vehicle = vehicles.find((item) => item.id === form.get('vehicle'));
    const nextAssignment = {
      name: form.get('driver'),
      email: form.get('email'),
      vehicle: form.get('vehicle'),
      client: vehicle?.client || '',
      hub: vehicle?.hub || '',
      date: form.get('date'),
      rawShift: form.get('shift'),
      status: 'Assigned',
      shift: `${form.get('date')} · ${form.get('shift')}`,
    };
    nextAssignment.sessionState = 'Ready';
    try {
      const payload = await apiJson('/api/driver-assignments', {
        method: 'POST',
        body: JSON.stringify({ ...nextAssignment, shift: nextAssignment.rawShift }),
      });
      const assignment = payload.assignment || nextAssignment;
      setDriverAssignments((current) => [assignment, ...current]);
      setVehicles((current) => current.map((item) => (
        item.id === assignment.vehicle
          ? {
              ...item,
              driverState: 'assigned',
              driver: assignment.name || item.driver,
              driverMeta: `${assignment.status || 'Assigned'} - ${assignment.shift || nextAssignment.shift}`,
              lastUpdated: 'just now',
            }
          : item
      )));
    } catch (error) {
      setToast(error.message || 'Unable to save driver assignment.');
      window.setTimeout(() => setToast(''), 2600);
      return;
    }
    formElement.reset();
    setToast('Driver assignment saved. Driver can now start the session.');
    window.setTimeout(() => setToast(''), 2600);
  }

  async function saveSettings(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextSettings = {
      goodCharge: Number(form.get('goodCharge')),
      minDistance: Number(form.get('minDistance')),
      minRunTime: Number(form.get('minRunTime')),
      electricityFactor: Number(form.get('electricityFactor')),
      cngFactor: Number(form.get('cngFactor')),
      cngConsumption: Number(form.get('cngConsumption')),
      evEnergy: Number(form.get('evEnergy')),
    };
    try {
      const payload = await apiJson('/api/settings', {
        method: 'POST',
        body: JSON.stringify(nextSettings),
      });
      setSettingsState(payload.settings || nextSettings);
      setToast('Alert thresholds and carbon factors saved.');
    } catch (error) {
      setToast(error.message || 'Unable to save settings.');
    }
    window.setTimeout(() => setToast(''), 2600);
  }

  async function requestOtp(event) {
    event.preventDefault();
    setLoginMessage('Sending OTP...');
    try {
      const payload = await apiJson('/api/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail }),
      });
      setOtpSent(true);
      setLoginMessage(
        payload.delivery === 'static-otp'
          ? 'Enter the configured dashboard OTP.'
          : payload.devOtp
            ? `OTP sent. Dev OTP: ${payload.devOtp}`
            : 'OTP sent to your email.'
      );
    } catch (error) {
      setLoginMessage(error.message || 'Unable to send OTP');
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    try {
      const payload = await apiJson('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, otp }),
      });
      setAuth((current) => ({ ...current, user: payload.user }));
      setLoginMessage('');
      setOtp('');
      setOtpSent(false);
    } catch (error) {
      setLoginMessage(error.message || 'Invalid OTP');
    }
  }

  async function logout() {
    await apiJson('/api/auth/logout', { method: 'POST' });
    setAuth({ user: null, authRequired: true, loading: false });
  }

  if (auth.loading) {
    return <AuthLoadingScreen />;
  }

  if (!auth.loading && auth.authRequired && !auth.user) {
    return <LoginScreen email={loginEmail} setEmail={setLoginEmail} otp={otp} setOtp={setOtp} otpSent={otpSent} requestOtp={requestOtp} verifyOtp={verifyOtp} message={loginMessage} />;
  }

  return (
    <div className="app-shell">
      <TopNav user={auth.user} logout={logout} />
      <main>
        <div className="title-row">
          <div>
            <h1>Green Logistics</h1>
            <p>Kyoto EV fleet command center</p>
          </div>
          <button
            className="ghost-action"
            type="button"
            onClick={() => {
              setVehicles((current) => current.map((vehicle) => ({ ...vehicle, lastUpdated: vehicle.status === 'Offline' ? vehicle.lastUpdated : 'just now' })));
              setToast('Latest vehicle snapshot refreshed.');
              window.setTimeout(() => setToast(''), 2400);
            }}
          >
            <RefreshCw size={18} /> Refresh telemetry
          </button>
        </div>

        <div className="tabs">
          {visibleTabs.map((tab) => (
            <button className={activeTab === tab ? 'tab active' : 'tab'} key={tab} onClick={() => setActiveTab(tab)} type="button">
              {tab}
            </button>
          ))}
        </div>

        {toast && <div className="toast">{toast}</div>}
        {activeTab === 'Overview' && <Overview vehicles={vehicles} tasks={tasks} clientHubs={clientHubs} parkings={parkings} />}
	        {activeTab === 'EV Fleet' && (
	          <FleetView
	            filteredVehicles={filteredVehicles}
	            selected={selected}
	            selectedId={selectedId}
	            setSelectedId={setSelectedId}
	            statusFilter={statusFilter}
	            setStatusFilter={setStatusFilter}
	            fleetFilters={fleetFilters}
	            setFleetFilters={setFleetFilters}
	            vehicleStatusOptions={vehicleStatusOptions}
	            modelOptions={modelOptions}
	            clientOptions={clientOptions}
	            activeVehicleCount={activeVehicleCount}
	            offlineVehicleCount={offlineVehicleCount}
	            query={query}
	            setQuery={setQuery}
	            mapConfig={mapConfig}
	            parkings={mapParkings}
	            clientHubs={mapClientHubs}
	            driverContactByVehicle={driverContactByVehicle}
	          />
	        )}
	        {activeTab === 'Clients' && (
	          <ClientsHub addClient={addClient} refreshClientHubs={reloadClientHubs} clientHubs={clientHubs} vehicles={vehicles} />
	        )}
	        {activeTab === 'Drivers' && (
	          <DriversHub
	            addDriver={addDriver}
	            drivers={drivers}
	            driverAssignments={driverAssignments}
	            vehicles={vehicles}
	            updateDriverPhone={updateDriverPhone}
	          />
	        )}
	        {activeTab === 'Parking' && (
	          <ParkingHub
	            parkings={parkings}
	            vehicles={vehicles}
	            addParkingSite={addParkingSite}
	          />
	        )}
	        
	        {activeTab === 'Operations' && (
          <OperationsHub
            addClient={addClient}
            assignments={driverAssignments}
            clientHubs={clientHubs}
            drivers={drivers}
            addDriver={addDriver}
            addDeployment={addDeployment}
            markTaskDone={markTaskDone}
            openFleet={() => setActiveTab('EV Fleet')}
            selectVehicle={setSelectedId}
            tasks={tasks}
            vehicles={vehicles}
            parkings={parkings}
            addParkingSite={addParkingSite}
            scheduleDeploymentEnd={scheduleDeploymentEnd}
            updateDeployment={updateDeployment}
          />
        )}
        {activeTab === 'Admin' && (
          <AdminHub
            exportReport={exportReport}
            range={range}
            rangeError={rangeError}
            saveSettings={saveSettings}
            settingsState={settingsState}
            validateRange={validateRange}
            vehicles={vehicles}
          />
        )}
      </main>
    </div>
  );
}

function TopNav({ user, logout }) {
  return (
    <header className="top-nav">
      <div className="brand-card">
        <div className="brand-mark"><Navigation size={22} /></div>
        <span>Fitsol</span>
      </div>
      <div className="profile">
        <div className="profile-logo">
          <Navigation size={15} />
          <small>Fitsol</small>
        </div>
        <div className="profile-text">
          <strong>{user?.name || 'GARV'}</strong>
          <span>{user?.role || 'admin'}</span>
        </div>
        <button className="nav-icon-button" type="button" onClick={logout} title="Sign out"><LogOut size={18} /></button>
      </div>
    </header>
  );
}

function AuthLoadingScreen() {
  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="brand-card">
          <div className="brand-mark"><Navigation size={22} /></div>
          <span>Fitsol</span>
        </div>
        <h1>Green Logistics</h1>
        <p>Checking your session...</p>
      </div>
    </main>
  );
}

function LoginScreen({ email, setEmail, otp, setOtp, otpSent, requestOtp, verifyOtp, message }) {
  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={otpSent ? verifyOtp : requestOtp}>
        <div className="brand-card">
          <div className="brand-mark"><Navigation size={22} /></div>
          <span>Fitsol</span>
        </div>
        <h1>Green Logistics</h1>
        <p>Sign in with the email listed in the Users tab.</p>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required /></label>
        {otpSent && <label>OTP<input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="6 digit code" inputMode="numeric" required /></label>}
        {message && <mark>{message}</mark>}
        <button className="primary-action" type="submit">{otpSent ? <LogIn size={18} /> : <Mail size={18} />}{otpSent ? 'Verify OTP' : 'Send OTP'}</button>
      </form>
    </main>
  );
}

function OperationsHub({
  addClient,
  addDeployment,
  assignments,
  clientHubs,
  drivers,
  addDriver,
  parkings,
  addParkingSite,
  markTaskDone,
  openFleet,
  selectVehicle,
  tasks,
  vehicles,
  scheduleDeploymentEnd,
  updateDeployment,
}) {
  const [deployOpen, setDeployOpen] = useState(false);
  const [endTarget, setEndTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [parkingModalOpen, setParkingModalOpen] = useState(false);
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [scheduledEnds, setScheduledEnds] = useState(() => new Map());

  const latestAssignmentByVehicle = useMemo(() => {
    const map = new Map();
    (assignments || []).forEach((row) => {
      if (!isCurrentDriverAssignment(row)) return;
      const id = String(row.vehicle || '').trim().toUpperCase();
      if (!id) return;
      const t = new Date(row.createdAt || row.created_at || row.updatedAt || row.updated_at || row.shiftDate || 0).getTime() || 0;
      const prev = map.get(id);
      const pt = prev ? (new Date(prev.createdAt || prev.created_at || prev.updatedAt || prev.updated_at || prev.shiftDate || 0).getTime() || 0) : -1;
      if (t >= pt) map.set(id, row);
    });
    return map;
  }, [assignments]);

  const deployed = useMemo(() => vehicles.filter(hasClientDeployment), [vehicles]);
  const tableRows = useMemo(() => deployed.map((vehicle) => {
    const assignment = latestAssignmentByVehicle.get(vehicle.id);
    const scheduled = scheduledEnds.get(vehicle.id);
    const fallbackDriver = safeValue(vehicle.driver, '');
    return {
      vehicle,
      assignment,
      scheduled,
      defaultDriver: safeValue(vehicle.driver, 'Not set'),
      currentDriver: assignment?.name
        ? `${assignment.name}${assignment.email ? ` (${assignment.email})` : ''}`
        : fallbackDriver && fallbackDriver !== 'No driver confirmed yet' ? fallbackDriver : 'Not assigned',
    };
  }), [deployed, latestAssignmentByVehicle, scheduledEnds]);

  const visibleRows = tableRows.slice(0, 10);

  async function handleScheduleEnd(payload) {
    const result = await scheduleDeploymentEnd(payload);
    if (result?.vehicle && result?.effectiveAt) {
      setScheduledEnds((current) => {
        const next = new Map(current);
        next.set(result.vehicle, { effectiveAt: result.effectiveAt, parking: result.parking, reason: result.reason, driverChoice: result.driverChoice });
        return next;
      });
      return true;
    }
    return false;
  }

  return (
    <section className="operations-v2">
      <div className="panel-title">
        <div className="panel-title-stack">
          <h2>Operations</h2>
          <p className="form-note">Manage deployments and ops tasks without breaking the workflow.</p>
        </div>
        <button className="primary-action compact-action" type="button" onClick={() => setDeployOpen(true)}>
          <Plus size={18} /> Deploy vehicle
        </button>
      </div>

      <div className="table-panel ops-deployments-panel">
        <div className="panel-title">
          <div>
            <h3>Active Deployments</h3>
            <p className="form-note">{deployed.length} deployed vehicle(s)</p>
          </div>
          <button className="ghost-action compact-action" type="button" onClick={openFleet}><MapPin size={17} /> View fleet</button>
        </div>

        <div className="table-wrap ops-table-wrap" role="region" aria-label="Deployments table">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Client</th>
                <th>Hub</th>
                <th>Parking</th>
                <th>Default driver</th>
                <th>Current driver</th>
                <th>Status</th>
                <th className="ops-action-col">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? visibleRows.map(({ vehicle, currentDriver, defaultDriver, scheduled }) => (
                <tr key={vehicle.id}>
                  <td>
                    <button className="ghost-link" type="button" onClick={() => selectVehicle(vehicle.id)}>{vehicle.id}</button>
                  </td>
                  <td>{safeValue(vehicle.client, 'Unassigned client')}</td>
                  <td>{safeValue(vehicle.hub, 'Unassigned hub')}</td>
                  <td>{safeValue(vehicle.parking, 'Parking unavailable')}</td>
                  <td>{defaultDriver}</td>
                  <td>{currentDriver}</td>
                  <td>
                    {scheduled
                      ? <span className="status-pill warning">Ending {relativeTimeFromNow(new Date(scheduled.effectiveAt).getTime() || Date.now())}</span>
                      : <span className="status-pill success">Active</span>}
                  </td>
                  <td className="ops-action-col">
                    <button className="ghost-action compact-action" type="button" onClick={() => setEditTarget(vehicle)} title="Edit deployment">
                      <Pencil size={17} />
                    </button>
                    <button className="primary-action compact-action danger" type="button" onClick={() => setEndTarget(vehicle)}>
                      <X size={17} /> End
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">No active deployments yet.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OpsActionCenter tasks={tasks} markTaskDone={markTaskDone} selectVehicle={selectVehicle} openFleet={openFleet} />

      {deployOpen && (
        <DeployVehicleModal
          vehicles={vehicles}
          clientHubs={clientHubs}
          parkings={parkings}
          drivers={drivers}
          addDeployment={addDeployment}
          closeModal={() => setDeployOpen(false)}
          onOpenAddClient={() => setClientModalOpen(true)}
          onOpenAddParking={() => setParkingModalOpen(true)}
          onOpenAddDriver={() => setDriverModalOpen(true)}
        />
      )}

      {editTarget && (
        <EditDeploymentModal
          vehicle={editTarget}
          clientHubs={clientHubs}
          parkings={parkings}
          drivers={drivers}
          closeModal={() => setEditTarget(null)}
          onOpenAddParking={() => setParkingModalOpen(true)}
          onOpenAddDriver={() => setDriverModalOpen(true)}
          updateDeployment={async (payload) => {
            const ok = await updateDeployment(payload);
            if (ok) setEditTarget(null);
          }}
        />
      )}

      {endTarget && (
        <EndDeploymentModal
          vehicle={endTarget}
          parkings={parkings}
          drivers={drivers}
          closeModal={() => setEndTarget(null)}
          onOpenAddParking={() => setParkingModalOpen(true)}
          onOpenAddDriver={() => setDriverModalOpen(true)}
          scheduleEnd={async (payload) => {
            const ok = await handleScheduleEnd(payload);
            if (ok) setEndTarget(null);
          }}
        />
      )}

      {clientModalOpen && <ClientOnboardingModal addClient={async (event) => { const ok = await addClient(event); if (ok) setClientModalOpen(false); }} closeModal={() => setClientModalOpen(false)} />}
      {parkingModalOpen && <ParkingOnboardingModal addParkingSite={async (data) => { const result = await addParkingSite(data); if (result?.ok) setParkingModalOpen(false); return result; }} closeModal={() => setParkingModalOpen(false)} />}
      {driverModalOpen && <DriverOnboardingModal addDriver={async (event) => { const ok = await addDriver(event); if (ok) setDriverModalOpen(false); }} closeModal={() => setDriverModalOpen(false)} />}
    </section>
  );
}

function EditDeploymentModal({ vehicle, clientHubs, parkings, drivers, closeModal, onOpenAddParking, onOpenAddDriver, updateDeployment }) {
  const clientRecord = clientHubs.find((item) => normalizeClientName(item.client) === normalizeClientName(vehicle.client));
  const hubs = normalizeLocationRecords(clientRecord?.hubs);
  const clientParkings = normalizeLocationRecords(clientRecord?.parkings);
  const globalParkings = Array.isArray(parkings) ? parkings.map((p) => ({
    name: p.name,
    gmpLink: p.gmpLink || '',
    lat: p.lat,
    lng: p.lng,
  })) : [];
  const combinedParkings = [...clientParkings, ...globalParkings];
  const [hub, setHub] = useState(vehicle.hub || hubs[0]?.name || '');
  const [parking, setParking] = useState(vehicle.parking || combinedParkings[0]?.name || '');
  const [driverEmail, setDriverEmail] = useState('');

  useEffect(() => {
    if (hubs.length && !hubs.some((item) => item.name === hub)) setHub(hubs[0].name);
  }, [hubs, hub]);

  useEffect(() => {
    if (combinedParkings.length && !combinedParkings.some((item) => item.name === parking)) setParking(combinedParkings[0].name);
  }, [combinedParkings, parking]);

  const selectedHub = hubs.find((item) => item.name === hub);
  const selectedParking = combinedParkings.find((item) => item.name === parking);
  const selectedDriver = (drivers || []).find((driver) => normalizeClientName(driver.email) === normalizeClientName(driverEmail));
  const driverOptions = useMemo(() => (drivers || []).map((driver) => ({
    id: driver.driverId || driver.id || driver.email,
    email: driver.email,
    label: `${driver.name}${driver.phone ? ` - ${driver.phone}` : ''}`,
  })), [drivers]);

  async function handleSubmit(event) {
    event.preventDefault();
    const hubCoords = coordsFromFields(selectedHub?.lat, selectedHub?.lng) || extractMapCoords(selectedHub?.gmpLink);
    const parkingCoords = coordsFromFields(selectedParking?.lat, selectedParking?.lng) || extractMapCoords(selectedParking?.gmpLink);
    if (!selectedHub || !hubCoords || !selectedParking || !parkingCoords) return;
    await updateDeployment({
      vehicle: vehicle.id,
      client: vehicle.client,
      hub,
      hubGmpLink: selectedHub.gmpLink || '',
      hubLat: hubCoords.lat,
      hubLng: hubCoords.lng,
      parking,
      parkingGmpLink: selectedParking.gmpLink || '',
      parkingLat: parkingCoords.lat,
      parkingLng: parkingCoords.lng,
      driverEmail,
      driverName: selectedDriver?.name || '',
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-card client-hub-form add-client-modal ops-deploy-modal" onSubmit={handleSubmit}>
        <div className="panel-title">
          <div>
            <span>Active deployment</span>
            <h2>Edit {vehicle.id}</h2>
          </div>
          <button className="ghost-action compact-action" type="button" onClick={closeModal}><X size={17} /> Close</button>
        </div>
        <div className="ops-form-row">
          <label>Vehicle<input value={vehicle.id} readOnly /></label>
          <label>Client<input value={vehicle.client} readOnly /></label>
        </div>
        <label>Hub<select value={hub} onChange={(event) => setHub(event.target.value)} required>{hubs.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        {combinedParkings.length ? (
          <div className="ops-form-row">
            <label>Parking<select value={parking} onChange={(event) => setParking(event.target.value)} required>{combinedParkings.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
            <button className="ghost-action compact-action" type="button" onClick={onOpenAddParking}><Plus size={16} /> Add parking</button>
          </div>
        ) : (
          <div className="empty-location">
            <strong>Parking not found</strong>
            <button className="primary-action compact-action" type="button" onClick={onOpenAddParking}><Plus size={18} /> Add parking</button>
          </div>
        )}
        <div className="ops-form-row">
          <label>Driver
            <select value={driverEmail} onChange={(event) => setDriverEmail(event.target.value)}>
              <option value="">Keep current driver</option>
              {driverOptions.map((driver) => <option key={driver.id} value={driver.email}>{driver.label}</option>)}
            </select>
          </label>
          <button className="ghost-action compact-action" type="button" onClick={onOpenAddDriver}><Plus size={16} /> Add driver</button>
        </div>
        <div className="modal-actions">
          <button className="ghost-action" type="button" onClick={closeModal}>Cancel</button>
          <button className="primary-action" type="submit"><Check size={18} /> Save changes</button>
        </div>
      </form>
    </div>
  );
}

function DeployVehicleModal({ vehicles, clientHubs, parkings, drivers, addDeployment, closeModal, onOpenAddClient, onOpenAddParking, onOpenAddDriver }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '');
  const [client, setClient] = useState(clientHubs[0]?.client || '');
  const [hub, setHub] = useState('');
  const [parking, setParking] = useState('');
  const [deployAt, setDeployAt] = useState(new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16));
  const [reason, setReason] = useState('');
  const [undeployAt, setUndeployAt] = useState('');
  const [useTransientParking, setUseTransientParking] = useState(false);
  const [transientParking, setTransientParking] = useState('');
  const [defaultDriverEmail, setDefaultDriverEmail] = useState('');

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) || vehicles[0];
  const deployedAlready = hasClientDeployment(selectedVehicle);

  const selectedClientRecord = clientHubs.find((item) => item.client === client) || clientHubs[0];
  const hubs = normalizeLocationRecords(selectedClientRecord?.hubs);
  const clientParkings = normalizeLocationRecords(selectedClientRecord?.parkings);
  const globalParkings = Array.isArray(parkings) ? parkings.map((p) => ({ name: p.name, gmpLink: p.gmpLink || '' })) : [];
  const combinedParkings = [...clientParkings, ...globalParkings];

  useEffect(() => {
    if (!hubs.some((h) => h.name === hub)) setHub(hubs[0]?.name || '');
  }, [hubs, hub]);

  useEffect(() => {
    if (!combinedParkings.some((p) => p.name === parking)) setParking(combinedParkings[0]?.name || '');
    if (!combinedParkings.some((p) => p.name === transientParking)) setTransientParking(combinedParkings[0]?.name || '');
  }, [combinedParkings, parking, transientParking]);

  const vehicleBarTone = (vehicle) => {
    const isDeployed = hasClientDeployment(vehicle);
    const isRunning = String(vehicle.status || '').toLowerCase().includes('run');
    if (!isDeployed) return 'good';
    if (isRunning) return 'bad';
    return 'warn';
  };

  const driverOptions = useMemo(() => (drivers || []).map((d) => ({ id: d.driverId || d.id, label: `${d.name}${d.phone ? ` • ${d.phone}` : ''}`, email: d.email, name: d.name })), [drivers]);

  const selectedHub = hubs.find((h) => h.name === hub);
  const selectedParking = combinedParkings.find((p) => p.name === parking);
  const selectedTransient = combinedParkings.find((p) => p.name === transientParking);
  const selectedDefaultDriver = driverOptions.find((d) => d.email === defaultDriverEmail);
  const layoverParking = deployedAlready && useTransientParking ? selectedTransient : selectedParking;

  async function handleSubmit(event) {
    // Build a form-shaped submit so we reuse the existing addDeployment handler (keeps state updates consistent).
    // eslint-disable-next-line no-param-reassign
    event.currentTarget.querySelector('input[name=\"vehicle\"]').value = vehicleId;
    event.currentTarget.querySelector('input[name=\"client\"]').value = client;
    event.currentTarget.querySelector('input[name=\"hub\"]').value = hub;
    event.currentTarget.querySelector('input[name=\"hubGmpLink\"]').value = selectedHub?.gmpLink || '';
    event.currentTarget.querySelector('input[name=\"parking\"]').value = parking;
    event.currentTarget.querySelector('input[name=\"parkingGmpLink\"]').value = selectedParking?.gmpLink || '';
    event.currentTarget.querySelector('input[name=\"deployAt\"]').value = new Date(deployAt).toISOString();
    event.currentTarget.querySelector('input[name=\"previousUndeployAt\"]').value = deployedAlready ? (undeployAt ? new Date(undeployAt).toISOString() : '') : '';
    event.currentTarget.querySelector('input[name=\"layoverParking\"]').value = layoverParking?.name || parking;
    event.currentTarget.querySelector('input[name=\"layoverParkingGmpLink\"]').value = layoverParking?.gmpLink || selectedParking?.gmpLink || '';
    event.currentTarget.querySelector('input[name=\"usage\"]').value = reason;
    event.currentTarget.querySelector('input[name=\"poc\"]').value = '';
    event.currentTarget.querySelector('input[name=\"driverEmail\"]').value = defaultDriverEmail;
    event.currentTarget.querySelector('input[name=\"driverName\"]').value = selectedDefaultDriver?.name || '';

    const ok = await addDeployment(event);
    if (ok) closeModal();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-card client-hub-form add-client-modal ops-deploy-modal" onSubmit={handleSubmit}>
        <div className="panel-title">
          <h2>Deploy Vehicle</h2>
          <button className="ghost-action compact-action" type="button" onClick={closeModal}><X size={17} /> Close</button>
        </div>

        <div className="ops-vehicle-picker">
          <div className="ops-vehicle-picker-title">
            <strong>Select vehicle</strong>
            <span className="form-note">Red: deployed & running, Yellow: deployed, Green: undeployed</span>
          </div>
          <div className="ops-vehicle-list" role="list">
            {vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                className={v.id === vehicleId ? `ops-vehicle-item active ${vehicleBarTone(v)}` : `ops-vehicle-item ${vehicleBarTone(v)}`}
                onClick={() => setVehicleId(v.id)}
              >
                <span className="ops-vehicle-id">{v.id}</span>
                <span className="ops-vehicle-meta">{deploymentStatusLabel(v)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ops-form-row">
          <label>Client<select value={client} onChange={(e) => setClient(e.target.value)} required>{clientHubs.map((c) => <option key={c.client} value={c.client}>{c.client}</option>)}</select></label>
          <button className="ghost-action compact-action" type="button" onClick={onOpenAddClient}><Plus size={16} /> Add client</button>
        </div>

        <label>Hub<select value={hub} onChange={(e) => setHub(e.target.value)} required>{hubs.map((h) => <option key={h.name} value={h.name}>{h.name}</option>)}</select></label>

        {combinedParkings.length ? (
          <div className="ops-form-row">
            <label>Parking<select value={parking} onChange={(e) => setParking(e.target.value)} required>{combinedParkings.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
            <button className="ghost-action compact-action" type="button" onClick={onOpenAddParking}><Plus size={16} /> Add parking</button>
          </div>
        ) : (
          <div className="empty-location">
            <strong>Parking not found</strong>
            <button className="primary-action compact-action" type="button" onClick={onOpenAddParking}><Plus size={18} /> Add parking</button>
          </div>
        )}

        <label>Deployment effective from<input type="datetime-local" value={deployAt} onChange={(e) => setDeployAt(e.target.value)} required /></label>

        {deployedAlready && (
          <>
            <label>Reason for change<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are we changing deployment?" required /></label>
            <label>Undeploy effective from<input type="datetime-local" value={undeployAt} onChange={(e) => setUndeployAt(e.target.value)} required /></label>
            <label className="checkbox-line">
              <input type="checkbox" checked={useTransientParking} onChange={(e) => setUseTransientParking(e.target.checked)} />
              <span>Transient parking required between undeploy & deploy</span>
            </label>
            {useTransientParking && (
              combinedParkings.length ? (
                <div className="ops-form-row">
                  <label>Transient parking<select value={transientParking} onChange={(e) => setTransientParking(e.target.value)} required>{combinedParkings.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
                  <button className="ghost-action compact-action" type="button" onClick={onOpenAddParking}><Plus size={16} /> Add parking</button>
                </div>
              ) : null
            )}
          </>
        )}

        <div className="ops-form-row">
          <label>Default driver (optional)
            <select value={defaultDriverEmail} onChange={(e) => setDefaultDriverEmail(e.target.value)}>
              <option value="">Use existing default ({safeValue(selectedVehicle?.driver, 'Not set')})</option>
              {driverOptions.map((d) => <option key={d.id} value={d.email}>{d.label}</option>)}
            </select>
          </label>
          <button className="ghost-action compact-action" type="button" onClick={onOpenAddDriver}><Plus size={16} /> Add driver</button>
        </div>
        <p className="form-note">Selected driver becomes the current driver for this vehicle.</p>

        {/* hidden fields expected by addDeployment */}
        <input type="hidden" name="vehicle" defaultValue={vehicleId} />
        <input type="hidden" name="client" defaultValue={client} />
        <input type="hidden" name="hub" defaultValue={hub} />
        <input type="hidden" name="hubGmpLink" defaultValue={selectedHub?.gmpLink || ''} />
        <input type="hidden" name="hubLat" defaultValue="" />
        <input type="hidden" name="hubLng" defaultValue="" />
        <input type="hidden" name="parking" defaultValue={parking} />
        <input type="hidden" name="parkingGmpLink" defaultValue={selectedParking?.gmpLink || ''} />
        <input type="hidden" name="parkingLat" defaultValue="" />
        <input type="hidden" name="parkingLng" defaultValue="" />
        <input type="hidden" name="deployAt" defaultValue="" />
        <input type="hidden" name="previousUndeployAt" defaultValue="" />
        <input type="hidden" name="layoverParking" defaultValue="" />
        <input type="hidden" name="layoverParkingGmpLink" defaultValue="" />
        <input type="hidden" name="layoverParkingLat" defaultValue="" />
        <input type="hidden" name="layoverParkingLng" defaultValue="" />
        <input type="hidden" name="usage" defaultValue="" />
        <input type="hidden" name="poc" defaultValue="" />
        <input type="hidden" name="driverEmail" defaultValue="" />
        <input type="hidden" name="driverName" defaultValue="" />

        <div className="modal-actions">
          <button className="ghost-action" type="button" onClick={closeModal}>Cancel</button>
          <button className="primary-action" type="submit"><Check size={18} /> Save deployment</button>
        </div>
      </form>
    </div>
  );
}

function EndDeploymentModal({ vehicle, parkings, drivers, closeModal, onOpenAddParking, onOpenAddDriver, scheduleEnd }) {
  const [reason, setReason] = useState('');
  const [effectiveAt, setEffectiveAt] = useState(new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16));
  const [parking, setParking] = useState(parkings?.[0]?.name || '');
  const [useDefaultDriver, setUseDefaultDriver] = useState(true);
  const [driverEmail, setDriverEmail] = useState('');

  const driverOptions = useMemo(() => (drivers || []).map((d) => ({ id: d.driverId || d.id, label: `${d.name}${d.phone ? ` • ${d.phone}` : ''}`, email: d.email })), [drivers]);

  useEffect(() => {
    if (!parkings?.some((p) => p.name === parking)) setParking(parkings?.[0]?.name || '');
  }, [parkings, parking]);

  async function submit(event) {
    event.preventDefault();
    const choice = useDefaultDriver ? `Default (${safeValue(vehicle.driver, 'Not set')})` : (driverEmail || 'Unspecified');
    await scheduleEnd({
      vehicle: vehicle.id,
      reason,
      effectiveAt: new Date(effectiveAt).toISOString(),
      parking,
      driverChoice: choice,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-card client-hub-form add-client-modal ops-end-modal" onSubmit={submit}>
        <div className="panel-title">
          <h2>End Deployment</h2>
          <button className="ghost-action compact-action" type="button" onClick={closeModal}><X size={17} /> Close</button>
        </div>
        <label>Vehicle<input value={`${vehicle.id} • ${safeValue(vehicle.client, '')}`} readOnly /></label>
        <label>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Completed, returned, reassigned..." required /></label>
        <label>Undeploy effective from<input type="datetime-local" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} required /></label>

        {parkings?.length ? (
          <div className="ops-form-row">
            <label>Park at<select value={parking} onChange={(e) => setParking(e.target.value)} required>{parkings.map((p) => <option key={p.parkingId || p.id} value={p.name}>{p.name}</option>)}</select></label>
            <button className="ghost-action compact-action" type="button" onClick={onOpenAddParking}><Plus size={16} /> Add parking</button>
          </div>
        ) : (
          <div className="empty-location">
            <strong>Parking not found</strong>
            <button className="primary-action compact-action" type="button" onClick={onOpenAddParking}><Plus size={18} /> Add parking</button>
          </div>
        )}

        <div className="ops-driver-choice">
          <div className="ops-driver-choice-title"><strong>Driver for this ops task</strong></div>
          <label className="checkbox-line">
            <input type="radio" name="driverChoice" checked={useDefaultDriver} onChange={() => setUseDefaultDriver(true)} />
            <span>Use default driver ({safeValue(vehicle.driver, 'Not set')})</span>
          </label>
          <label className="checkbox-line">
            <input type="radio" name="driverChoice" checked={!useDefaultDriver} onChange={() => setUseDefaultDriver(false)} />
            <span>Assign a different driver</span>
          </label>
          {!useDefaultDriver && (
            <div className="ops-form-row">
              <label>Driver<select value={driverEmail} onChange={(e) => setDriverEmail(e.target.value)} required>{driverOptions.map((d) => <option key={d.id} value={d.email}>{d.label}</option>)}</select></label>
              <button className="ghost-action compact-action" type="button" onClick={onOpenAddDriver}><Plus size={16} /> Add driver</button>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="ghost-action" type="button" onClick={closeModal}>Cancel</button>
          <button className="primary-action danger" type="submit"><Check size={18} /> Schedule undeploy</button>
        </div>
      </form>
    </div>
  );
}

function AdminHub({ exportReport, range, rangeError, saveSettings, settingsState, validateRange, vehicles }) {
  return (
    <div className="stacked-workspace">
      <AlertsPanel />
      <SettingsPanel settingsState={settingsState} saveSettings={saveSettings} />
    </div>
  );
}

function DriverConsole({ assignments, driverSession, setDriverSession }) {
  const activeAssignment = assignments.find(isCurrentDriverAssignment);
  const [sessionMessage, setSessionMessage] = useState('');
  async function toggleSession() {
    if (!activeAssignment?.assignmentId) return;
    const nextState = driverSession === 'Active session' ? 'Ended session' : 'Active session';
    setSessionMessage('');
    try {
      const payload = await apiJson('/api/driver-session', {
        method: 'POST',
        body: JSON.stringify({ assignmentId: activeAssignment.assignmentId, state: nextState }),
      });
      setDriverSession(payload.assignment?.sessionState || nextState);
      setSessionMessage('Driver session updated.');
    } catch (error) {
      setSessionMessage(error.message || 'Unable to update driver session.');
    }
  }
  return (
    <section className="assignment-layout">
      <div className="driver-card">
        <h3>Driver mobile view</h3>
        <p>Today&apos;s assigned vehicle</p>
        <strong>{activeAssignment?.vehicle || 'No vehicle assigned'}</strong>
        <span>{activeAssignment ? `${activeAssignment.client || 'Client'} - ${activeAssignment.hub || 'Hub'}` : 'Ask ops to assign a vehicle'}</span>
        <mark>{driverSession}</mark>
        {sessionMessage && <p className="form-note">{sessionMessage}</p>}
        <button className="primary-action" type="button" disabled={!activeAssignment} onClick={toggleSession}>
          {driverSession === 'Active session' ? 'End Session' : 'Start Session'}
        </button>
      </div>
      <div className="table-panel">
        <div className="panel-title">
          <h2>My Assignments</h2>
          <span>{assignments.length} assignment(s)</span>
        </div>
        <DataTable
          columns={['Vehicle', 'Client', 'Hub', 'Shift', 'Status']}
          rows={assignments.map((driver) => [driver.vehicle, driver.client, driver.hub, driver.shift, driver.status])}
        />
      </div>
    </section>
  );
}

function Overview({ vehicles, tasks, clientHubs, parkings }) {
  const [trendPeriod, setTrendPeriod] = useState('week');
  const [carbonTrend, setCarbonTrend] = useState({ loading: true, points: [], error: '' });
  const [carbonSummary, setCarbonSummary] = useState({ loading: true, error: '', todayKg: 0, monthToDateKg: 0, totalKg: 0, rateKgPerKm: 0 });
  const pending = tasks.filter((task) => task.status === 'Pending').length;
  const deployedVehicles = vehicles.filter(hasClientDeployment);
  const activeClientCount = new Set(deployedVehicles.map((vehicle) => normalizeClientName(vehicle.client)).filter(Boolean)).size;
  const activeVehicles = vehicles.filter((vehicle) => vehicle.status !== 'Offline').length;
  const offlineVehicles = vehicles.filter((vehicle) => vehicle.status === 'Offline').length;
  const carbonSavedToday = Number(carbonSummary.todayKg) || 0;
  const carbonSavedMonth = Number(carbonSummary.monthToDateKg) || 0;
  const carbonSavedTotal = Number(carbonSummary.totalKg) || 0;
  const carbonPerKm = Number(carbonSummary.rateKgPerKm) || 0;
  const vehiclesAtParking = countVehiclesAtParking(vehicles, clientHubs, parkings);
  const trendPoints = carbonTrend.points;
  const carbonMetric = (value) => {
    if (carbonSummary.loading) return 'Loading...';
    if (carbonSummary.error) return 'Unavailable';
    return `${formatNumber(value)} kg`;
  };

  useEffect(() => {
    let cancelled = false;
    setCarbonTrend((current) => ({ ...current, loading: true, error: '' }));
    apiJson(`/api/carbon-trend?period=${trendPeriod}`)
      .then((payload) => {
        if (!cancelled) setCarbonTrend({ loading: false, points: payload.points || [], error: '' });
      })
      .catch((error) => {
        if (!cancelled) setCarbonTrend({ loading: false, points: [], error: error.message || 'Unable to load trend.' });
      });
    return () => {
      cancelled = true;
    };
  }, [trendPeriod]);

  useEffect(() => {
    let cancelled = false;
    setCarbonSummary((current) => ({ ...current, loading: true, error: '' }));
    apiJson('/api/carbon-summary')
      .then((payload) => {
        if (!cancelled) setCarbonSummary({ loading: false, error: '', ...payload });
      })
      .catch((error) => {
        if (!cancelled) setCarbonSummary((current) => ({ ...current, loading: false, error: error.message || 'Unable to load carbon summary.' }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="overview-workspace">
      <div className="overview-grid">
        <MetricCard icon={UsersRound} label="Onboarded clients" value={clientHubs.length} />
        <MetricCard icon={UsersRound} label="Active clients" value={activeClientCount} />
        <MetricCard icon={Truck} label="Vehicles deployed" value={deployedVehicles.length} />
        <MetricCard icon={Zap} label="Vehicles active" value={activeVehicles} />
        <MetricCard icon={CircleAlert} label="Vehicles offline" value={offlineVehicles} />
        <MetricCard icon={MapPin} label="Vehicles at parking" value={vehiclesAtParking} />
        <MetricCard icon={Gauge} label="Carbon saved today vs CNG" value={carbonMetric(carbonSavedToday)} />
        <MetricCard icon={Gauge} label="Carbon saved this month" value={carbonMetric(carbonSavedMonth)} />
        <MetricCard icon={Gauge} label="Carbon saved till date" value={carbonMetric(carbonSavedTotal)} />
        <MetricCard icon={Route} label="Carbon saved per km" value={carbonSummary.loading ? 'Loading...' : carbonSummary.error ? 'Unavailable' : `${formatNumber(carbonPerKm)} kg/km`} />
        <MetricCard icon={CircleAlert} label="Pending ops tasks" value={pending} />
      </div>
      <CarbonTrendPanel
        period={trendPeriod}
        setPeriod={setTrendPeriod}
        points={trendPoints}
        loading={carbonTrend.loading}
        error={carbonTrend.error}
      />
    </section>
  );
}

function CarbonTrendPanel({ period, setPeriod, points, loading, error }) {
  const hasData = points.some((point) => Number(point.value) > 0);
  return (
    <section className="trend-panel">
      <div className="panel-title trend-title">
        <div>
          <h2>Carbon Saved Trend</h2>
          <span>{period === 'week' ? 'Last 7 days' : period === 'month' ? 'Last 30 days' : 'Last 12 months'}</span>
        </div>
        <div className="trend-range">
          {[
            ['week', '7 days'],
            ['month', 'Monthly'],
            ['year', 'Yearly'],
          ].map(([value, label]) => (
            <button className={period === value ? 'active' : ''} key={value} type="button" onClick={() => setPeriod(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="chart-empty">Loading carbon trend...</div>
      ) : error ? (
        <div className="chart-empty">Trend unavailable: {error}</div>
      ) : hasData ? (
        <CarbonTrendChart points={points} />
      ) : (
        <div className="chart-empty">No historical carbon records available yet. The chart will populate as scraper snapshots are stored.</div>
      )}
    </section>
  );
}

function CarbonTrendChart({ points }) {
  const width = 900;
  const height = 260;
  const padding = { top: 24, right: 22, bottom: 46, left: 58 };
  const maxValue = Math.max(...points.map((point) => Number(point.value) || 0), 1);
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const step = points.length > 1 ? usableWidth / (points.length - 1) : usableWidth;
  const coords = points.map((point, index) => ({
    x: padding.left + step * index,
    y: padding.top + usableHeight - ((Number(point.value) || 0) / maxValue) * usableHeight,
    value: Number(point.value) || 0,
    label: point.label,
  }));
  const path = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${path} L ${padding.left + step * (coords.length - 1)} ${padding.top + usableHeight} L ${padding.left} ${padding.top + usableHeight} Z`;
  const labelEvery = points.length > 12 ? Math.ceil(points.length / 6) : 1;
  return (
    <div className="carbon-chart-wrap">
      <svg className="carbon-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Carbon saved trend chart">
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + usableHeight} />
        <line x1={padding.left} y1={padding.top + usableHeight} x2={width - padding.right} y2={padding.top + usableHeight} />
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + usableHeight - ratio * usableHeight;
          return (
            <g key={ratio}>
              <line className="chart-gridline" x1={padding.left} y1={y} x2={width - padding.right} y2={y} />
              <text className="chart-y-label" x={padding.left - 12} y={y + 4}>{formatNumber(maxValue * ratio)}</text>
            </g>
          );
        })}
        <path className="chart-area" d={areaPath} />
        <path className="chart-line" d={path} />
        {coords.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle className="chart-point" cx={point.x} cy={point.y} r="4" />
            {(index % labelEvery === 0 || index === coords.length - 1) && (
              <text className="chart-x-label" x={point.x} y={height - 14}>{point.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function FleetView({ filteredVehicles, selected, selectedId, setSelectedId, statusFilter, setStatusFilter, fleetFilters, setFleetFilters, vehicleStatusOptions, modelOptions, clientOptions, activeVehicleCount, offlineVehicleCount, query, setQuery, mapConfig, parkings, clientHubs, driverContactByVehicle }) {
  return (
    <>
      <Toolbar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        fleetFilters={fleetFilters}
        setFleetFilters={setFleetFilters}
        vehicleStatusOptions={vehicleStatusOptions}
        modelOptions={modelOptions}
        clientOptions={clientOptions}
        activeVehicleCount={activeVehicleCount}
        offlineVehicleCount={offlineVehicleCount}
        query={query}
        setQuery={setQuery}
      />
      <section className="fleet-layout">
        <aside className="vehicle-list">
          {filteredVehicles.length ? filteredVehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} selected={selectedId === vehicle.id} vehicle={vehicle} driverContact={driverContactByVehicle?.get(vehicle.id)} onClick={() => setSelectedId(vehicle.id)} />
          )) : <div className="empty-state">No vehicles match the selected filters.</div>}
        </aside>
        <div className="map-column">
          <FleetMap vehicles={filteredVehicles} selectedId={selectedId} setSelectedId={setSelectedId} mapConfig={mapConfig} parkings={parkings} clientHubs={clientHubs} />
          {selected ? (
            <VehicleDetail vehicle={selected} parkings={parkings} driverContact={driverContactByVehicle?.get(selected?.id)} />
          ) : (
            <section className="detail-panel empty-state">Select different filters to view vehicle details.</section>
          )}
        </div>
      </section>
    </>
  );
}

function Toolbar({ statusFilter, setStatusFilter, fleetFilters, setFleetFilters, vehicleStatusOptions, modelOptions, clientOptions, activeVehicleCount, offlineVehicleCount, query, setQuery }) {
  const scopedStatusOptions = useMemo(() => vehicleStatusOptions.filter((status) => (
    statusFilter === 'Offline' ? status === 'Offline' : status !== 'Offline'
  )), [vehicleStatusOptions, statusFilter]);
  return (
    <section className="toolbar">
      <div className="status-toggle">
        <button className={statusFilter === 'Active' ? 'pill active' : 'pill'} onClick={() => setStatusFilter('Active')} type="button">
          Active <span>{activeVehicleCount}</span>
        </button>
        <button className={statusFilter === 'Offline' ? 'pill active' : 'pill'} onClick={() => setStatusFilter('Offline')} type="button">
          Offline <span>{offlineVehicleCount}</span>
        </button>
      </div>
      <label className="search-box">
        <Search size={20} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." />
      </label>
      <FleetFilterBar
        fleetFilters={fleetFilters}
        setFleetFilters={setFleetFilters}
        clientOptions={clientOptions}
        modelOptions={modelOptions}
        statusOptions={scopedStatusOptions}
      />
    </section>
  );
}

function FleetFilterBar({ fleetFilters, setFleetFilters, clientOptions, modelOptions, statusOptions }) {
  const [open, setOpen] = useState(false);
  const activeCount = fleetFilters.clients.length + fleetFilters.models.length + fleetFilters.statuses.length;

  useEffect(() => {
    function onDocClick(event) {
      if (!open) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.filter-popover') || target.closest('.filter-trigger')) return;
      setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  function toggleItem(field, value) {
    setFleetFilters((current) => {
      const values = new Set(current[field] || []);
      if (values.has(value)) values.delete(value);
      else values.add(value);
      return { ...current, [field]: [...values] };
    });
  }

  function clearAll() {
    setFleetFilters({ clients: [], models: [], statuses: [] });
  }

  return (
    <div className="fleet-filters">
      <button className="filter-trigger" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Filter size={18} />
        Filters{activeCount ? ` (${activeCount})` : ''}
      </button>
      {open && (
        <div className="filter-popover" role="dialog" aria-label="Fleet filters">
          <div className="filter-popover-head">
            <strong>Filter fleet</strong>
            <button className="ghost-link" type="button" onClick={clearAll} disabled={!activeCount}>Clear</button>
          </div>
          <div className="filter-popover-grid">
            <FilterSection title="Clients" field="clients" options={clientOptions} selected={fleetFilters.clients} toggleItem={toggleItem} />
            <FilterSection title="Model" field="models" options={modelOptions} selected={fleetFilters.models} toggleItem={toggleItem} />
            <FilterSection title="Status" field="statuses" options={statusOptions} selected={fleetFilters.statuses} toggleItem={toggleItem} />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSection({ title, field, options, selected, toggleItem }) {
  return (
    <div className="filter-section">
      <div className="filter-section-title">{title}</div>
      <div className="filter-section-list" role="list">
        {options.length ? options.map((option) => (
          <label className="filter-check" key={`${field}-${option}`}>
            <input type="checkbox" checked={selected.includes(option)} onChange={() => toggleItem(field, option)} />
            <span title={option}>{option}</span>
          </label>
        )) : (
          <div className="filter-empty">No options</div>
        )}
      </div>
    </div>
  );
}

function VehicleCard({ vehicle, driverContact, selected, onClick }) {
  const lastUpdatedLabel = formatIndiaTimestamp(vehicle.lastUpdated) || formatRelativeTimestamp(vehicle.lastUpdated);
  const runningTimeLabel = ensureRunningTime(vehicle.runningTime, vehicle.todayDistance);
  const avgSpeedLabel = ensureAverageSpeed(vehicle.avgSpeed, vehicle.todayDistance, vehicle.runningTime);
  return (
    <button className={selected ? 'vehicle-card selected' : 'vehicle-card'} type="button" onClick={onClick}>
      <div className="vehicle-card-top">
        <div>
          <span className="muted">Vehicle</span>
          <h3>{vehicle.id}</h3>
        </div>
        <span className={`status-dot ${vehicle.status.toLowerCase()}`}>{vehicle.status}</span>
      </div>
      <div className="split">
        <Info label="Client" value={safeValue(vehicle.client, 'Unassigned client')} />
        <Info label="Hub" value={safeValue(vehicle.hub, 'Unassigned hub')} />
      </div>
      <div className="split">
        <Info label="Driver" value={safeValue(driverContact?.name || vehicle.driver, 'No driver')} />
        <Info label="Driver email" value={safeValue(driverContact?.email, 'No driver email')} />
      </div>
      <div className="battery-line">
        <div>
          <span>Battery</span>
          <strong>{formatPercent(vehicle.battery)}</strong>
        </div>
        <div className="progress"><span style={{ width: `${clampNumber(vehicle.battery, 0, 100)}%` }} /></div>
      </div>
      <div className="bottom-grid">
        <Info label="Today" value={`${formatNumber(vehicle.todayDistance)} km`} strong />
        <Info label="Running time" value={safeValue(runningTimeLabel)} />
        <Info label="Odometer" value={formatOdometer(vehicle.odometer)} />
      </div>
      <div className="insight-grid">
        <Info label="CO2e saved vs CNG" value={safeValue(vehicle.carbon)} strong />
        <Info label="Average speed" value={safeValue(avgSpeedLabel)} />
        <Info label="Last stop" value={safeValue(vehicle.lastStop, 'No stop recorded today')} />
        <Info label="Source" value={safeValue(vehicle.sourceSystem, 'Telemetry source pending')} />
      </div>
      <Info label="Last update" value={safeValue(lastUpdatedLabel)} />
    </button>
  );
}

function Info({ label, value, strong, badge }) {
  const text = String(value ?? '');
  return (
    <div className="info">
      <span>{label}</span>
      {badge ? <mark title={text}>{value}</mark> : strong ? <strong title={text}>{value}</strong> : <p title={text}>{value}</p>}
    </div>
  );
}

function FleetMap({ vehicles, selectedId, setSelectedId, mapConfig, parkings = [], clientHubs = [] }) {
  const [activeMarkerId, setActiveMarkerId] = useState('');
  const mapMarkers = buildMapMarkers(vehicles, selectedId, parkings, clientHubs);
  const activeMarker = mapMarkers.find((marker) => marker.id === activeMarkerId);

  if (mapConfig?.enabled) {
    return <RealGoogleMap apiKey={mapConfig.apiKey} mapId={mapConfig.mapId} vehicles={vehicles} selectedId={selectedId} setSelectedId={setSelectedId} parkings={parkings} clientHubs={clientHubs} />;
  }

  return (
    <section className="map-card">
      <div className="map-banner">
        Real Google Maps is waiting for GOOGLE_MAPS_API_KEY. Showing dashboard map preview.
      </div>
      <div className="map-surface">
        <div className="map-label india">India</div>
        <div className="map-label pakistan">Pakistan</div>
        <div className="map-label bangladesh">Bangladesh</div>
        <div className="map-label sea">Arabian Sea</div>
        <svg className="route-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M40 68 C46 61 50 58 55 59 S62 52 66 45" />
          <path d="M46 72 C49 66 50 61 49 55 S51 47 48 41" />
        </svg>
        {mapMarkers.map((marker) => {
          const point = previewPointForMarker(marker);
          if (!point) return null;
          const className = [
            marker.selected ? `map-dot ${marker.kind} active` : `map-dot ${marker.kind}`,
            marker.kind === 'vehicle' ? 'vehicle-marker-button' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              aria-label={marker.title}
              aria-pressed={marker.kind === 'vehicle' ? marker.selected : undefined}
              className={className}
              key={marker.id}
              style={{ left: `${point.x}%`, top: `${point.y}%`, '--marker-color': markerColor(marker) }}
              type="button"
              onClick={() => {
                if (marker.vehicleId) setSelectedId(marker.vehicleId);
                setActiveMarkerId(marker.id);
              }}
              title={marker.title}
            >
              {marker.kind === 'vehicle' ? <VehicleMarkerGlyph vehicleId={marker.vehicleId} /> : null}
            </button>
          );
        })}
        <MapMarkerInfo marker={activeMarker} onClose={() => setActiveMarkerId('')} />
        <div className="map-legend" aria-label="Map marker legend">
          <span><i className="legend-dot vehicle" />Vehicle</span>
          <span><i className="legend-dot hub" />Hub</span>
          <span><i className="legend-dot parking" />Parking</span>
        </div>
        <div className="map-control expand">⛶</div>
        <div className="map-control locate">⌖</div>
        <div className="zoom-control"><span>+</span><span>-</span></div>
        <div className="google-mark">Google</div>
      </div>
    </section>
  );
}

function RealGoogleMap({ apiKey, mapId, vehicles, selectedId, setSelectedId, parkings = [], clientHubs = [] }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapError, setMapError] = useState('');
  const [activeMarkerId, setActiveMarkerId] = useState('');
  const mapMarkers = useMemo(() => buildMapMarkers(vehicles, selectedId, parkings, clientHubs), [vehicles, selectedId, parkings, clientHubs]);
  const activeMarker = mapMarkers.find((marker) => marker.id === activeMarkerId);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(async () => {
        if (cancelled || !mapEl.current) return;
        const { Map } = await window.google.maps.importLibrary('maps');
        mapRef.current = new Map(mapEl.current, {
          center: { lat: 20.5937, lng: 78.9629 },
          zoom: 5,
          ...(mapId ? { mapId } : {}),
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
        });
      })
      .catch((error) => setMapError(error.message));
    return () => {
      cancelled = true;
    };
  }, [apiKey, mapId]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    let disposed = false;
    async function renderMarkers() {
      const markerLibrary = mapId ? await window.google.maps.importLibrary('marker') : null;
      if (disposed || !mapRef.current) return;
      clearRenderedMapMarkers(markersRef.current);
      markersRef.current = [];
      const renderedMarkers = mapMarkers
        .filter((marker) => marker.coords)
        .map((marker) => {
          const position = marker.coords;
          if (!markerLibrary?.AdvancedMarkerElement) {
            const gmMarker = new window.google.maps.Marker({
              map: mapRef.current,
              position,
              title: marker.title,
              icon: googleDotIcon(markerColor(marker), marker.selected, marker.kind),
              zIndex: markerZIndex(marker),
            });
            gmMarker.addListener('click', () => {
              if (marker.vehicleId) setSelectedId(marker.vehicleId);
              setActiveMarkerId(marker.id);
            });
            return gmMarker;
          }
          const markerNode = dotMarkerNodeFor(marker);
          markerNode.addEventListener('click', () => {
            if (marker.vehicleId) setSelectedId(marker.vehicleId);
            setActiveMarkerId(marker.id);
          });
          return new markerLibrary.AdvancedMarkerElement({
            map: mapRef.current,
            position,
            title: marker.title,
            content: markerNode,
            zIndex: markerZIndex(marker),
          });
        });
      if (disposed) {
        clearRenderedMapMarkers(renderedMarkers);
        return;
      }
      const selected = vehicles.find((vehicle) => vehicle.id === selectedId);
      markersRef.current = renderedMarkers;
      const focusCoords = [
        vehicleCoordsFor(selected),
        hubCoordsFor(selected),
        parkingCoordsFor(selected),
      ].filter(Boolean);
      if (!disposed && focusCoords.length > 1) {
        const bounds = new window.google.maps.LatLngBounds();
        focusCoords.forEach((coords) => bounds.extend(coords));
        mapRef.current.fitBounds(bounds, 72);
      } else if (!disposed && focusCoords[0]) {
        mapRef.current.panTo(focusCoords[0]);
      }
    }
    renderMarkers();
    return () => {
      disposed = true;
      clearRenderedMapMarkers(markersRef.current);
      markersRef.current = [];
    };
  }, [vehicles, selectedId, setSelectedId, mapId, mapMarkers]);

  return (
    <section className="map-card">
      {mapError && <div className="map-banner error">Google Maps failed to load: {mapError}</div>}
      <div className="real-map" ref={mapEl} />
      <MapMarkerInfo marker={activeMarker} onClose={() => setActiveMarkerId('')} />
    </section>
  );
}

function clearRenderedMapMarkers(markers = []) {
  markers.forEach((marker) => {
    if ('map' in marker) marker.map = null;
    else marker.setMap(null);
  });
}

function MapMarkerInfo({ marker, onClose }) {
  if (!marker) return null;
  return (
    <div className="map-info-card">
      <button aria-label="Close map marker details" type="button" onClick={onClose}>X</button>
      <span>{marker.kind}</span>
      <strong>{marker.title}</strong>
      <dl>
        {marker.details?.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{typeof value === 'string' && value.match(/^https?:\/\//) ? <a href={value} target="_blank" rel="noreferrer">link</a> : safeValue(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (window.__googleMapsLoading) return window.__googleMapsLoading;
  window.__googleMapsLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=marker&callback=__initGoogleMaps`;
    script.async = true;
    script.onerror = () => reject(new Error('script load failed'));
    window.__initGoogleMaps = () => resolve();
    document.head.appendChild(script);
  });
  return window.__googleMapsLoading;
}

function dotMarkerNodeFor(marker) {
  if (marker.kind === 'vehicle') return vehicleMarkerNodeFor(marker);
  const markerNode = document.createElement('button');
  markerNode.className = marker.selected ? `google-marker-dot ${marker.kind} active` : `google-marker-dot ${marker.kind}`;
  markerNode.type = 'button';
  markerNode.title = marker.title;
  markerNode.setAttribute('aria-label', marker.title);
  markerNode.innerHTML = '<span class="marker-icon" aria-hidden="true"></span>';
  return markerNode;
}

function vehicleMarkerNodeFor(marker) {
  const markerNode = document.createElement('button');
  markerNode.className = marker.selected
    ? 'google-marker-dot vehicle vehicle-marker-button active'
    : 'google-marker-dot vehicle vehicle-marker-button';
  markerNode.type = 'button';
  markerNode.title = marker.title;
  markerNode.setAttribute('aria-label', marker.title);
  markerNode.setAttribute('aria-pressed', marker.selected ? 'true' : 'false');
  markerNode.style.setProperty('--marker-color', markerColor(marker));
  markerNode.innerHTML = vehicleMarkerGlyphHtml(marker.vehicleId);
  return markerNode;
}

function VehicleMarkerGlyph({ vehicleId }) {
  return (
    <span className="vehicle-marker-glyph" aria-hidden="true">
      <span className="vehicle-marker-halo" />
      <span className="vehicle-marker-shadow" />
      <span className="vehicle-marker-body">
        <span className="vehicle-marker-window front" />
        <span className="vehicle-marker-window rear" />
        <span className="vehicle-marker-hood" />
        <span className="vehicle-marker-wheel front-left" />
        <span className="vehicle-marker-wheel front-right" />
        <span className="vehicle-marker-wheel rear-left" />
        <span className="vehicle-marker-wheel rear-right" />
      </span>
      <span className="vehicle-marker-label">{shortVehicleLabel(vehicleId)}</span>
    </span>
  );
}

function vehicleMarkerGlyphHtml(vehicleId) {
  return `
    <span class="vehicle-marker-glyph" aria-hidden="true">
      <span class="vehicle-marker-halo"></span>
      <span class="vehicle-marker-shadow"></span>
      <span class="vehicle-marker-body">
        <span class="vehicle-marker-window front"></span>
        <span class="vehicle-marker-window rear"></span>
        <span class="vehicle-marker-hood"></span>
        <span class="vehicle-marker-wheel front-left"></span>
        <span class="vehicle-marker-wheel front-right"></span>
        <span class="vehicle-marker-wheel rear-left"></span>
        <span class="vehicle-marker-wheel rear-right"></span>
      </span>
      <span class="vehicle-marker-label">${escapeHtml(shortVehicleLabel(vehicleId))}</span>
    </span>
  `;
}

function shortVehicleLabel(vehicleId) {
  const text = String(vehicleId || '').trim().toUpperCase();
  return text.length > 4 ? text.slice(-4) : text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function googleDotIcon(fill, selected = false, kind = 'vehicle') {
  if (kind === 'vehicle') return googleVehicleIcon(fill, selected);
  const size = selected ? 30 : 24;
  const glyph = mapMarkerSvg(kind);
  const svg = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10.5" fill="rgba(15,23,42,0.22)"/>
    <circle cx="12" cy="12" r="9" fill="${fill}" stroke="#ffffff" stroke-width="2"/>
    ${glyph}
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size / 2),
  };
}

function googleVehicleIcon(fill, selected = false) {
  const width = selected ? 58 : 48;
  const height = selected ? 44 : 36;
  const halo = selected ? '<ellipse cx="32" cy="24" rx="28" ry="19" fill="#00a060" opacity="0.22"/><ellipse cx="32" cy="24" rx="24" ry="16" fill="none" stroke="#00a060" stroke-width="3"/>' : '';
  const svg = `<svg viewBox="0 0 64 48" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="body" x1="18" x2="46" y1="10" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#ffd15a"/>
        <stop offset="0.52" stop-color="${fill}"/>
        <stop offset="1" stop-color="#b96f00"/>
      </linearGradient>
    </defs>
    ${halo}
    <ellipse cx="32" cy="37" rx="20" ry="6" fill="#111827" opacity="0.2"/>
    <rect x="16" y="14" width="32" height="22" rx="8" fill="url(#body)" stroke="#ffffff" stroke-width="2"/>
    <path d="M24 15h16l4 6H20l4-6Z" fill="#fff8df" opacity="0.55"/>
    <rect x="24" y="20" width="16" height="9" rx="4" fill="#ffffff" opacity="0.82"/>
    <rect x="20" y="18" width="4" height="14" rx="2" fill="#111827"/>
    <rect x="40" y="18" width="4" height="14" rx="2" fill="#111827"/>
    <path d="M26 31h12" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(width, height),
    anchor: new window.google.maps.Point(width / 2, height / 2),
  };
}

function buildMapMarkers(vehicles, selectedId, globalParkings = [], clientHubs = []) {
  const markers = [];
  const hubKeys = new Set();
  vehicles.forEach((vehicle) => {
    const selected = vehicle.id === selectedId;
    markers.push({
      id: `vehicle-${vehicle.id}`,
      kind: 'vehicle',
      coords: vehicleCoordsFor(vehicle),
      fallbackPoint: fallbackPointFor(vehicle),
      selected,
      title: `${vehicle.id} - ${vehicle.status}`,
      vehicleId: vehicle.id,
      details: [
        ['Status', vehicle.status],
        ['Model', modelLabelFor(vehicle)],
        ['Battery', formatPercent(vehicle.battery)],
        ['Client', safeValue(vehicle.client, 'Unassigned client')],
        ['Hub', safeValue(vehicle.hub, 'Unassigned hub')],
        ['Parking', safeValue(vehicle.parking, 'Parking unavailable')],
      ],
    });
    addLocationMarker(markers, vehicle, 'hub', selected, hubKeys);
    addLocationMarker(markers, vehicle, 'parking', selected);
  });
  (clientHubs || []).forEach((client) => {
    normalizeLocationRecords(client.hubs).forEach((hub, index) => {
      const coords = coordsFromFields(hub.lat, hub.lng) || extractMapCoords(hub.gmpLink);
      if (!coords) return;
      const key = mapLocationKey(coords, hub.name);
      if (hubKeys.has(key)) return;
      hubKeys.add(key);
      markers.push({
        id: `client-hub-${normalizeClientName(client.client)}-${index}-${normalizeMapScopeName(hub.name)}`,
        kind: 'hub',
        coords,
        selected: false,
        title: `Hub: ${hub.name}`,
        details: [
          ['Hub', hub.name],
          ['Client', safeValue(client.client, 'Unassigned client')],
          ['Map', hub.gmpLink || ''],
        ],
      });
    });
  });
  // add standalone global parking site markers
  (globalParkings || []).forEach((p) => {
    const coords = coordsFromFields(p.lat, p.lng) || extractMapCoords(p.gmpLink);
    if (!coords) return;
    markers.push({
      id: `site-${p.name}`,
      kind: 'parking',
      coords,
      selected: false,
      title: `Parking site: ${p.name}`,
      details: [
        ['Parking', p.name],
      ],
    });
  });
  return markers;
}

function addLocationMarker(markers, vehicle, kind, selected, locationKeys = null) {
  const coords = kind === 'hub' ? hubCoordsFor(vehicle) : parkingCoordsFor(vehicle);
  if (!coords) return;
  const name = kind === 'hub' ? safeValue(vehicle.hub, 'Mapped hub') : safeValue(vehicle.parking, 'Mapped parking');
  const key = mapLocationKey(coords, name);
  if (locationKeys) locationKeys.add(key);
  markers.push({
    id: `${kind}-${vehicle.id}`,
    kind,
    coords,
    selected,
    title: `${kind === 'hub' ? 'Hub' : 'Parking'}: ${name}`,
    vehicleId: vehicle.id,
    details: kind === 'hub'
      ? [
          ['Hub', name],
          ['Client', safeValue(vehicle.client, 'Unassigned client')],
          ['Vehicle', vehicle.id],
          ['Status', vehicle.status],
        ]
      : [
          ['Parking', name],
          ['Vehicle', vehicle.id],
          ['Hub', safeValue(vehicle.hub, 'Unassigned hub')],
          ['Place status', safeValue(vehicle.locationState, 'Not assigned to a hub/parking geofence')],
        ],
  });
}

function vehicleCoordsFor(vehicle) {
  return coordsFromFields(vehicle?.lat, vehicle?.lng);
}

function hubCoordsFor(vehicle) {
  return coordsFromFields(vehicle?.hubLat, vehicle?.hubLng) || extractMapCoords(vehicle?.hubGmpLink);
}

function parkingCoordsFor(vehicle) {
  return coordsFromFields(vehicle?.parkingLat, vehicle?.parkingLng) || extractMapCoords(vehicle?.parkingGmpLink);
}

function mapLocationKey(coords, name = '') {
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  const coordKey = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)},${lng.toFixed(5)}` : '';
  return `${coordKey}:${normalizeMapScopeName(name)}`;
}

function fallbackPointFor(vehicle) {
  const x = Number(vehicle?.x);
  const y = Number(vehicle?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function previewPointForMarker(marker) {
  return projectCoordsToPreview(marker.coords) || marker.fallbackPoint;
}

function projectCoordsToPreview(coords) {
  if (!coords) return null;
  const x = clampNumber(((coords.lng - 68) / 30) * 72 + 14, 8, 92);
  const y = clampNumber(((36 - coords.lat) / 30) * 78 + 10, 8, 92);
  return { x, y };
}

function markerColor(marker) {
  if (marker.kind === 'hub') return '#0b7a53';
  if (marker.kind === 'parking') return '#000000';
  return '#f5a400';
}

function mapMarkerSvg(kind) {
  // Simple, high-contrast marker glyphs (kept minimal so they stay legible when zoomed out).
  if (kind === 'hub') {
    return '<path d="M7 10.5 12 7l5 3.5V18a1 1 0 0 1-1 1h-2.2v-4.2h-3.6V19H8a1 1 0 0 1-1-1v-7.5Z" fill=\"#fff\" opacity=\"0.95\"/>';
  }
  if (kind === 'parking') {
    return '<path d="M9 7.6h3.9c2 0 3.3 1.2 3.3 3.1 0 2-1.3 3.2-3.3 3.2H11V19H9V7.6Zm2 1.8v2.7h1.7c1 0 1.6-.5 1.6-1.35S13.7 9.4 12.7 9.4H11Z" fill=\"#fff\" opacity=\"0.95\"/>';
  }
  // vehicle
  return '<path d="M7.4 15.7a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm9.2 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM7.7 8.4h8.6c.7 0 1.3.4 1.6 1.1l1 2.4c.1.3.2.6.2.9V15a1 1 0 0 1-1 1h-.7a2.8 2.8 0 0 0-5.6 0H10.4a2.8 2.8 0 0 0-5.6 0H4a1 1 0 0 1-1-1v-2.2c0-.3.1-.6.2-.9l1-2.4c.3-.7.9-1.1 1.6-1.1Zm.3 2.1-.7 1.7h9.4l-.7-1.7H8Z" fill=\"#fff\" opacity=\"0.95\"/>';
}

function markerZIndex(marker) {
  if (marker.kind === 'vehicle' && marker.selected) return 100;
  if (marker.selected) return 60;
  if (marker.kind === 'vehicle') return 50;
  if (marker.kind === 'hub') return 30;
  return 20;
}

function normalizeMapLink(link) {
  const trimmed = String(link || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function mapLinkInfo(link) {
  const normalized = normalizeMapLink(link);
  if (!normalized) return { valid: false, coords: null, normalized, message: '' };
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch (error) {
    return { valid: false, coords: null, normalized, message: 'Enter a valid URL.' };
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const isGoogleMapsHost = host === 'maps.app.goo.gl'
    || host === 'goo.gl'
    || host.startsWith('maps.google.')
    || ((host === 'google.com' || host.startsWith('www.google.') || host.endsWith('.google.com')) && path.startsWith('/maps'));
  const coords = extractMapCoords(normalized);
  if (!isGoogleMapsHost) return { valid: false, coords, normalized, message: 'Only Google Maps links are accepted.' };
  if (!coords) return { valid: false, coords: null, normalized, message: 'Open Google Maps, choose a place, then copy a link that contains coordinates.' };
  return { valid: true, coords, normalized, message: 'Valid Google Maps link.' };
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

function coordsFromFields(latValue, lngValue) {
  const lat = Number(latValue);
  const lng = Number(lngValue);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
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

function VehicleDetail({ vehicle, parkings = [], driverContact }) {
  const [stopDayRange, setStopDayRange] = useState(7);
  const lastUpdatedLabel = formatIndiaTimestamp(vehicle.lastUpdated) || formatRelativeTimestamp(vehicle.lastUpdated);
  const runningTimeLabel = ensureRunningTime(vehicle.runningTime, vehicle.todayDistance);
  const avgSpeedLabel = ensureAverageSpeed(vehicle.avgSpeed, vehicle.todayDistance, vehicle.runningTime);
  const placeLabel = useNearPlaceLabel(vehicle?.lat, vehicle?.lng);
  const stops = vehicle.stops?.length ? vehicle.stops : [{
    location: vehicle.lastStop,
    distanceTodayKm: vehicle.todayDistance,
    runningTime: runningTimeLabel,
    scrapedAt: vehicle.lastUpdated,
    status: vehicle.status,
  }];
  const visibleStops = stops
    .filter((stop) => isWithinDayRange(stop.scrapedAt, stopDayRange))
    .slice(0, 10);
  const stopRangeOptions = [1, 2, 7];
  return (
    <section className="detail-panel">
      <div className="detail-heading">
        <div>
          <h2>{vehicle.id}</h2>
          <p>{vehicle.client} · {vehicle.hub}</p>
        </div>
        <span className={`status-dot ${vehicle.status.toLowerCase()}`}>{vehicle.status}</span>
      </div>
      <div className="detail-grid">
        <MetricMini icon={BatteryCharging} label="Battery" value={`${vehicle.battery}%`} />
        <MetricMini icon={Route} label="Distance today" value={`${vehicle.todayDistance} km`} />
        <MetricMini icon={Gauge} label="Running time" value={safeValue(runningTimeLabel)} />
        <MetricMini icon={Car} label="Odometer" value={formatOdometer(vehicle.odometer)} />
        <MetricMini icon={Zap} label="CO2e saved vs CNG" value={safeValue(vehicle.carbon)} />
      </div>
      <div className="detail-tabs">
        <div>
          <h3>Now</h3>
          <p>Current location: {safeValue(placeLabel || vehicle.location)}</p>
          <p>Last stop: {safeValue(vehicle.lastStop)}</p>
          <p>Assigned parking: {safeValue(vehicle.parking)}</p>
          <p>Average speed: {safeValue(avgSpeedLabel)}</p>
          <p>Last update: {safeValue(lastUpdatedLabel)}</p>
        </div>
        <div>
          <h3>Driver</h3>
          <p>{vehicle.driverState === 'active' ? 'Currently driven by' : vehicle.driverState === 'assigned' ? 'Assigned driver today' : vehicle.driverState === 'last' ? 'Last driven by' : 'Driver status'}</p>
          <strong>{vehicle.driver}</strong>
          {driverContact?.email ? <p className="muted">Contact: {driverContact.email}</p> : null}
          <p>{vehicle.driverMeta}</p>
        </div>
        <div>
          <h3>Assignment</h3>
          <p>Parking: {vehicle.parking}</p>
          <p>Place status: {vehicle.locationState || 'Not assigned to a hub/parking geofence'}</p>
          {vehicle.hubGmpLink && <p><ActionLink href={vehicle.hubGmpLink} icon={MapPin} label="Open hub map" /></p>}
          {vehicle.parkingGmpLink && <p><ActionLink href={vehicle.parkingGmpLink} icon={ParkingCircle} label="Open parking map" /></p>}
          <p>Carbon basis: {safeValue(vehicle.confidence, 'Estimated vs CNG')}</p>
        </div>
        <div className="stops-panel">
          <div className="stops-heading">
            <h3>Stops</h3>
            <div className="stop-range-control" role="group" aria-label="Stops day range">
              {stopRangeOptions.map((days) => (
                <button
                  type="button"
                  key={days}
                  className={stopDayRange === days ? 'active' : ''}
                  aria-pressed={stopDayRange === days}
                  onClick={() => setStopDayRange(days)}
                >
                  Last {days} {days === 1 ? 'Day' : 'Days'}
                </button>
              ))}
            </div>
          </div>
          {visibleStops.length ? (
            <div className="stop-timeline" aria-label={`Stops from last ${stopDayRange} ${stopDayRange === 1 ? 'day' : 'days'}`}>
              {visibleStops.map((stop, index) => (
                <article className="stop-timeline-item" key={`${stop.scrapedAt || index}-${stop.location}`}>
                  <span className="stop-timeline-marker" aria-hidden="true" />
                  <div className="stop-timeline-card">
                    <strong>{safeValue(stop.location, 'No stop recorded')}</strong>
                    <small>{safeValue(formatIndiaTimestamp(stop.scrapedAt), 'Time unavailable')}</small>
                    <small>{formatNumber(stop.distanceTodayKm)} km - {safeValue(ensureRunningTime(stop.runningTime, stop.distanceTodayKm), '0h 0m')}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="stop-empty">No stops recorded in this range</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ActionLink({ href, icon: Icon, label }) {
  return (
    <a className="action-link" href={href} target="_blank" rel="noreferrer">
      <Icon size={18} />
      <span>{label}</span>
      <ExternalLink size={16} className="action-link-external" />
    </a>
  );
}

function ClientsHub({ addClient, refreshClientHubs, clientHubs, vehicles }) {
  const [viewingClient, setViewingClient] = useState(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [newHubName, setNewHubName] = useState('');
  const [newHubLink, setNewHubLink] = useState('');
  const [clientQuery, setClientQuery] = useState('');

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clientHubs;
    return clientHubs.filter((client) => {
      const hubs = normalizeLocationRecords(client.hubs).map((h) => `${h.name} ${h.gmpLink}`).join(' ');
      const deployedCount = vehicles.filter((vehicle) => normalizeClientName(vehicle.client) === normalizeClientName(client.client) && hasClientDeployment(vehicle)).length;
      const haystack = [
        client.client,
        client.gstNumber,
        client.clientPoc,
        hubs,
        String(deployedCount),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [clientHubs, clientQuery, vehicles]);

  async function openClientHubs(client) {
    setViewingClient(client);
    // ensure fresh data
    if (refreshClientHubs) await refreshClientHubs();
  }

  async function addHubForClient(e) {
    e && e.preventDefault();
    if (!viewingClient || !newHubName) return;
    try {
      const payload = await apiJson('/api/client-hubs', {
        method: 'POST',
        body: JSON.stringify({ client: viewingClient.client, gstNumber: viewingClient.gstNumber || '', clientPoc: viewingClient.clientPoc || '', hubs: `${newHubName} | ${newHubLink}`, parkings: '' }),
      });
      setNewHubName(''); setNewHubLink('');
      if (refreshClientHubs) await refreshClientHubs();
      setViewingClient(payload.clients?.find((c) => c.client === viewingClient.client) || viewingClient);
    } catch (error) {
      // ignore for now
    }
  }

  async function handleAddClient(event) {
    const saved = await addClient(event);
    if (saved) {
      setClientModalOpen(false);
      if (refreshClientHubs) await refreshClientHubs();
    }
  }

  return (
    <section className="table-panel">
      <div className="panel-title">
        <div className="panel-title-stack">
          <h2>Clients</h2>
          <label className="search-box panel-search">
            <Search size={18} />
            <input value={clientQuery} onChange={(event) => setClientQuery(event.target.value)} placeholder="Search clients..." />
          </label>
        </div>
        <button className="primary-action compact-action" type="button" onClick={() => setClientModalOpen(true)}><Plus size={18} /> Add Client</button>
      </div>
      {filteredClients.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>GST number</th>
                <th>Client POC</th>
                <th>Hubs</th>
                <th>Vehicles deployed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const hubs = normalizeLocationRecords(client.hubs);
                const deployedCount = vehicles.filter((vehicle) => normalizeClientName(vehicle.client) === normalizeClientName(client.client) && hasClientDeployment(vehicle)).length;
                return (
                  <tr key={client.client}>
                    <td>{client.client}</td>
                    <td>{safeValue(client.gstNumber, 'Not added')}</td>
                    <td>{safeValue(client.clientPoc, 'Not added')}</td>
                    <td><button className="ghost-action" type="button" onClick={() => openClientHubs(client)}>{hubs.length}</button></td>
                    <td>{deployedCount}</td>
                    <td>
                      <button className="ghost-action compact-action" type="button" onClick={() => openClientHubs(client)} title="Edit client hubs">
                        <Pencil size={17} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">{clientHubs.length ? 'No matching clients found.' : 'No reusable clients added yet.'}</div>
      )}

      {viewingClient && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card hub-modal">
            <div className="panel-title hub-modal-title">
              <div>
                <span>Client locations</span>
                <h3>Hubs for {viewingClient.client}</h3>
              </div>
              <button className="ghost-action compact-action" type="button" onClick={() => setViewingClient(null)}><X size={17} /> Close</button>
            </div>
            <div className="hub-modal-body">
              <div className="hub-modal-section">
                <strong>Hubs</strong>
                <div className="location-list">
                  {normalizeLocationRecords(viewingClient.hubs).map((h) => (
                    <a className="location-link" key={h.name} href={h.gmpLink} target="_blank" rel="noreferrer">
                      <MapPin size={17} />
                      <span>{h.name}</span>
                      <ExternalLink size={15} />
                    </a>
                  ))}
                  {!normalizeLocationRecords(viewingClient.hubs).length && <span className="empty-location">No hubs added yet.</span>}
                </div>
              </div>
              <form onSubmit={addHubForClient} className="hub-modal-form">
                <label>New hub name<input value={newHubName} onChange={(e) => setNewHubName(e.target.value)} required /></label>
                <label>Google Maps link<input value={newHubLink} onChange={(e) => setNewHubLink(e.target.value)} placeholder="https://maps.google.com/..." /></label>
                <div className="hub-modal-actions">
                  <button className="primary-action" type="submit"><Plus size={17} /> Add hub</button>
                  <button className="ghost-action" type="button" onClick={() => { setNewHubName(''); setNewHubLink(''); }}><RefreshCw size={17} /> Clear</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {clientModalOpen && <ClientOnboardingModal addClient={handleAddClient} closeModal={() => setClientModalOpen(false)} />}
    </section>
  );
}

function DriversHub({ addDriver, drivers = [], driverAssignments = [], vehicles = [], updateDriverPhone }) {
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editPhone, setEditPhone] = useState('');
  const [driverQuery, setDriverQuery] = useState('');

  const currentVehicleByEmail = useMemo(() => {
    const latest = new Map();
    driverAssignments.forEach((assignment) => {
      if (!isCurrentDriverAssignment(assignment)) return;
      const email = normalizeClientName(assignment.email);
      if (!email) return;
      const time = new Date(assignment.updatedAt || assignment.createdAt || 0).getTime();
      const prev = latest.get(email);
      const prevTime = prev ? new Date(prev.updatedAt || prev.createdAt || 0).getTime() : -1;
      if (time >= prevTime) latest.set(email, assignment);
    });
    const map = new Map();
    latest.forEach((assignment, email) => {
      const status = String(assignment.status || '').toLowerCase();
      const session = String(assignment.sessionState || '').toLowerCase();
      const active = session.includes('active') || status.includes('started') || status.includes('assigned');
      map.set(email, active ? assignment.vehicle : '');
    });
    drivers.forEach((driver) => {
      const email = normalizeClientName(driver.email);
      if (!email || map.get(email)) return;
      const byEmail = vehicles.find((vehicle) => normalizeClientName(vehicle.driverEmail || '') === email && hasClientDeployment(vehicle));
      const byName = vehicles.find((vehicle) => normalizeClientName(vehicle.driver || '') === normalizeClientName(driver.name) && hasClientDeployment(vehicle));
      const vehicle = byEmail || byName;
      if (vehicle?.id) map.set(email, vehicle.id);
    });
    return map;
  }, [driverAssignments, drivers, vehicles]);

  function beginEdit(driver) {
    setEditing(driver);
    setEditPhone(driver.phone || '');
  }

  async function saveEdit() {
    if (!editing) return;
    const saved = await updateDriverPhone(editing.driverId, editPhone);
    if (saved) {
      setEditing(null);
      setEditPhone('');
    }
  }

  return (
    <section className="table-panel">
      <div className="panel-title">
        <div className="panel-title-stack">
          <h2>Drivers</h2>
          <label className="search-box panel-search">
            <Search size={18} />
            <input value={driverQuery} onChange={(event) => setDriverQuery(event.target.value)} placeholder="Search drivers..." />
          </label>
        </div>
        <button className="primary-action compact-action" type="button" onClick={() => setDriverModalOpen(true)}><Plus size={18} /> Add Driver</button>
      </div>

      {drivers.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Contact number</th>
                <th>Email</th>
                <th>License</th>
                <th>DOB</th>
                <th>Deployed vehicle</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {drivers.filter((driver) => {
                const q = driverQuery.trim().toLowerCase();
                if (!q) return true;
                const emailKey = normalizeClientName(driver.email);
                const deployedVehicle = currentVehicleByEmail.get(emailKey) || 'Not deployed';
                const haystack = [
                  driver.name,
                  driver.phone,
                  driver.email,
                  driver.licenseNumber,
                  driver.dob,
                  deployedVehicle,
                ].join(' ').toLowerCase();
                return haystack.includes(q);
              }).map((driver) => {
                const emailKey = normalizeClientName(driver.email);
                const deployedVehicle = currentVehicleByEmail.get(emailKey) || 'Not deployed';
                return (
                  <tr key={driver.driverId}>
                    <td>{driver.name}</td>
                    <td>{driver.phone}</td>
                    <td>{driver.email}</td>
                    <td>{driver.licenseNumber}</td>
                    <td>{driver.dob}</td>
                    <td>{deployedVehicle}</td>
                    <td>
                      <button className="ghost-action compact-action" type="button" onClick={() => beginEdit(driver)} title="Edit contact number">
                        <Pencil size={17} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">No drivers onboarded yet.</div>
      )}

      {driverModalOpen && <DriverOnboardingModal addDriver={async (event) => { const ok = await addDriver(event); if (ok) setDriverModalOpen(false); return ok; }} closeModal={() => setDriverModalOpen(false)} />}

      {editing && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card add-client-modal">
            <div className="panel-title">
              <h2>Edit Driver</h2>
              <button className="ghost-action compact-action" type="button" onClick={() => setEditing(null)}><X size={17} /> Close</button>
            </div>
            <label>Driver<input value={editing.name} readOnly /></label>
            <label>Contact number<input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} type="tel" placeholder="+91 98765 43210" pattern="[0-9+()\\-\\s]{7,20}" required /></label>
            <div className="modal-actions">
              <button className="ghost-action" type="button" onClick={() => setEditing(null)}>Cancel</button>
              <button className="primary-action" type="button" onClick={saveEdit}><Check size={18} /> Save</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ParkingHub({ parkings = [], vehicles = [], addParkingSite }) {
  const [parkingModalOpen, setParkingModalOpen] = useState(false);
  const [parkingQuery, setParkingQuery] = useState('');

  const parkedCountBySite = useMemo(() => {
    const map = new Map();
    (parkings || []).forEach((p) => {
      const key = p.parkingId || p.id || p.name;
      const coords = coordsFromFields(p.lat, p.lng) || extractMapCoords(p.gmpLink);
      if (!key || !coords) {
        if (key) map.set(key, 0);
        return;
      }
      let count = 0;
      (vehicles || []).forEach((v) => {
        const vCoords = coordsFromFields(v.lat, v.lng);
        if (!vCoords) return;
        if (distanceMeters(vCoords, coords) <= 100) count += 1;
      });
      map.set(key, count);
    });
    return map;
  }, [parkings, vehicles]);

  const deployedCountBySite = useMemo(() => {
    const map = new Map();
    (parkings || []).forEach((p) => {
      const key = p.parkingId || p.id || p.name;
      const siteName = normalizeMapScopeName(p.name);
      const siteCoords = coordsFromFields(p.lat, p.lng) || extractMapCoords(p.gmpLink);
      const count = (vehicles || []).filter((vehicle) => {
        if (!hasClientDeployment(vehicle)) return false;
        const sameName = siteName && normalizeMapScopeName(vehicle.parking) === siteName;
        const vehicleParkingCoords = parkingCoordsFor(vehicle);
        const sameCoords = siteCoords && vehicleParkingCoords && distanceMeters(siteCoords, vehicleParkingCoords) <= 100;
        return sameName || sameCoords;
      }).length;
      if (key) map.set(key, count);
    });
    return map;
  }, [parkings, vehicles]);

  const filtered = useMemo(() => {
    const q = parkingQuery.trim().toLowerCase();
    if (!q) return parkings;
    return parkings.filter((p) => {
      const siteKey = p.parkingId || p.id || p.name;
      const haystack = [
        p.name,
        p.location,
        p.gmpLink,
        String(parkedCountBySite.get(siteKey) ?? 0),
        String(deployedCountBySite.get(siteKey) ?? 0),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [parkings, parkingQuery, parkedCountBySite, deployedCountBySite]);

  return (
    <section className="table-panel">
      <div className="panel-title">
        <div className="panel-title-stack">
          <h2>Parking</h2>
          <label className="search-box panel-search">
            <Search size={18} />
            <input value={parkingQuery} onChange={(event) => setParkingQuery(event.target.value)} placeholder="Search parking..." />
          </label>
        </div>
        <button className="primary-action compact-action" type="button" onClick={() => setParkingModalOpen(true)}><Plus size={18} /> Add Parking</button>
      </div>

      {filtered.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Parked now</th>
                <th>Total deployed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.parkingId || p.id}>
                  <td>{p.name}</td>
                  <td>
                    {p.gmpLink ? (
                      <a className="location-link compact" href={p.gmpLink} target="_blank" rel="noreferrer">Click here</a>
                    ) : (
                      'Not added'
                    )}
                  </td>
                  <td>{parkedCountBySite.get(p.parkingId || p.id || p.name) ?? 0}</td>
                  <td>{deployedCountBySite.get(p.parkingId || p.id || p.name) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">{parkings.length ? 'No matching parking sites found.' : 'No parking sites onboarded yet.'}</div>
      )}

      {parkingModalOpen && <ParkingOnboardingModal addParkingSite={addParkingSite} closeModal={() => setParkingModalOpen(false)} />}
    </section>
  );
}

function ParkingOnboardingModal({ addParkingSite, closeModal }) {
  const [formState, setFormState] = useState({ name: '', location: '', gmpLink: '' });
  const [error, setError] = useState('');

  function onChange(patch) {
    setFormState((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const info = mapLinkInfo(formState.gmpLink);
    if (!info.valid) {
      setError(info.message || 'Use a valid Google Maps link.');
      return;
    }
    const result = await addParkingSite(formState);
    if (result?.ok) closeModal();
    else if (result?.error) setError(result.error);
    else setError('Unable to add parking.');
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-card client-hub-form add-client-modal" onSubmit={handleSubmit}>
        <div className="panel-title">
          <h2>Add Parking</h2>
          <button className="ghost-action compact-action" type="button" onClick={closeModal}><X size={17} /> Close</button>
        </div>
        <label>Parking name<input value={formState.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Parking name" required /></label>
        <label>Location<input value={formState.location} onChange={(e) => onChange({ location: e.target.value })} placeholder="Location label (e.g. Hosur)" required /></label>
        <label>Google Maps link<input value={formState.gmpLink} onChange={(e) => onChange({ gmpLink: e.target.value })} placeholder="https://www.google.com/maps/..." required /></label>
        <MapLinkPreview link={formState.gmpLink} />
        {error ? <p className="form-note">{error}</p> : null}
        <div className="modal-actions">
          <button className="ghost-action" type="button" onClick={closeModal}>Cancel</button>
          <button className="primary-action" type="submit"><Plus size={18} /> Add Parking</button>
        </div>
      </form>
    </div>
  );
}

function DriverOnboardingModal({ addDriver, closeModal }) {
  async function handleSubmit(event) {
    const saved = await addDriver(event);
    if (saved) closeModal();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-card client-hub-form add-client-modal" onSubmit={handleSubmit}>
        <div className="panel-title">
          <h2>Add Driver</h2>
          <button className="ghost-action compact-action" type="button" onClick={closeModal}><X size={17} /> Close</button>
        </div>
        <label>Driver name<input name="name" placeholder="Full name" required /></label>
        <label>Contact number<input name="phone" type="tel" placeholder="+91 98765 43210" pattern="[0-9+()\\-\\s]{7,20}" required /></label>
        <label>Driver license number<input name="licenseNumber" placeholder="License number" required /></label>
        <label>Date of birth<input name="dob" type="date" required /></label>
        <label>Email ID<input name="email" type="email" placeholder="name@company.com" required /></label>
        <div className="modal-actions">
          <button className="ghost-action" type="button" onClick={closeModal}>Cancel</button>
          <button className="primary-action" type="submit"><Plus size={18} /> Add Driver</button>
        </div>
      </form>
    </div>
  );
}

function Deployments({ addClient, addDeployment, removeDeployment, removeDeploymentNow, clientHubs, vehicles, parkings = [] }) {
  const [selectedClient, setSelectedClient] = useState(clientHubs[0]?.client || '');
  const [selectedHub, setSelectedHub] = useState('');
  const [selectedParking, setSelectedParking] = useState('');
  const [selectedLayoverParking, setSelectedLayoverParking] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [endPrevious, setEndPrevious] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) || vehicles[0];
  const selectedClientRecord = clientHubs.find((item) => item.client === selectedClient) || clientHubs[0];
  const hubs = normalizeLocationRecords(selectedClientRecord?.hubs);
  const clientParkings = normalizeLocationRecords(selectedClientRecord?.parkings);
  const globalParkings = Array.isArray(parkings) ? parkings.map((p) => ({ name: p.name, gmpLink: p.gmpLink || '', lat: p.lat, lng: p.lng })) : [];
  const combinedParkings = [...clientParkings, ...globalParkings];
  const selectedHubRecord = hubs.find((hub) => hub.name === selectedHub) || hubs[0];
  const selectedParkingRecord = combinedParkings.find((parking) => parking.name === selectedParking) || combinedParkings[0];
  const selectedLayoverParkingRecord = combinedParkings.find((parking) => parking.name === selectedLayoverParking) || selectedParkingRecord;
  const vehicleEligible = canScheduleVehicleForDeployment(selectedVehicle);
  const canDeploy = Boolean(vehicles.length && selectedVehicle && selectedClient && hubs.length && combinedParkings.length);
  const deployedVehicles = vehicles.filter(hasClientDeployment);

  useEffect(() => {
    if (!vehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      setSelectedVehicleId(vehicles[0]?.id || '');
    }
  }, [vehicles, selectedVehicleId]);

  useEffect(() => {
    if (!clientHubs.some((item) => item.client === selectedClient)) {
      setSelectedClient(clientHubs[0]?.client || '');
    }
  }, [clientHubs, selectedClient]);

  useEffect(() => {
    if (!hubs.some((hub) => hub.name === selectedHub)) {
      setSelectedHub(hubs[0]?.name || '');
    }
  }, [hubs, selectedHub]);

  useEffect(() => {
    if (!combinedParkings.some((parking) => parking.name === selectedParking)) {
      setSelectedParking(combinedParkings[0]?.name || '');
    }
    if (!combinedParkings.some((parking) => parking.name === selectedLayoverParking)) {
      setSelectedLayoverParking(combinedParkings[0]?.name || '');
    }
  }, [combinedParkings, selectedParking, selectedLayoverParking]);

  async function handleAddClient(event) {
    const saved = await addClient(event);
    if (saved) setClientModalOpen(false);
  }

  return (
    <section className="form-grid">
      <form className="ops-form" onSubmit={addDeployment}>
        <h2>Deploy Vehicle To Client</h2>
        <label>Vehicle<select name="vehicle" value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)} required>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.id} - {deploymentStatusLabel(vehicle)}</option>)}</select></label>
        {selectedVehicle && (
          <div className={`deployment-status`}>
            <strong>{deploymentStatusLabel(selectedVehicle)}</strong>
            {hasClientDeployment(selectedVehicle) && <div className="form-note">This vehicle is currently deployed to {safeValue(selectedVehicle.client)}.</div>}
            {selectedVehicle.status !== 'Offline' && <div className="form-note">Current status: {selectedVehicle.status}. If you want to end current deployment/activity, check "End previous deployment" and select a time.</div>}
            <label style={{ marginTop: 8, display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={endPrevious} onChange={(e) => setEndPrevious(e.target.checked)} /> End previous deployment
            </label>
          </div>
        )}
        <label>Client<select name="client" value={selectedClient} onChange={(event) => setSelectedClient(event.target.value)} required>{clientHubs.map((item) => <option key={item.client} value={item.client}>{item.client}</option>)}</select></label>
        <label>Client hub<select name="hub" value={selectedHub} onChange={(event) => setSelectedHub(event.target.value)} required>{hubs.map((hub) => <option key={hub.name} value={hub.name}>{hub.name}</option>)}</select></label>
        <input name="hubGmpLink" type="hidden" value={selectedHubRecord?.gmpLink || ''} />
        <input name="hubLat" type="hidden" value={selectedHubRecord?.lat || ''} />
        <input name="hubLng" type="hidden" value={selectedHubRecord?.lng || ''} />
        <label>Nearest parking<select name="parking" value={selectedParking} onChange={(event) => setSelectedParking(event.target.value)} required>{combinedParkings.map((parking) => <option key={parking.name} value={parking.name}>{parking.name}</option>)}</select></label>
        <input name="parkingGmpLink" type="hidden" value={selectedParkingRecord?.gmpLink || ''} />
        <input name="parkingLat" type="hidden" value={selectedParkingRecord?.lat || ''} />
        <input name="parkingLng" type="hidden" value={selectedParkingRecord?.lng || ''} />
        {endPrevious && <label>Undeploy previous site at<input name="previousUndeployAt" type="datetime-local" required /></label>}
        <label>Deploy at<input name="deployAt" type="datetime-local" required /></label>
        <label>Layover parking<select name="layoverParking" value={selectedLayoverParking} onChange={(event) => setSelectedLayoverParking(event.target.value)} required>{combinedParkings.map((parking) => <option key={parking.name} value={parking.name}>{parking.name}</option>)}</select></label>
        <input name="layoverParkingGmpLink" type="hidden" value={selectedLayoverParkingRecord?.gmpLink || ''} />
        <input name="layoverParkingLat" type="hidden" value={selectedLayoverParkingRecord?.lat || ''} />
        <input name="layoverParkingLng" type="hidden" value={selectedLayoverParkingRecord?.lng || ''} />
        <label>How this vehicle will be used<select name="usage"><option>Shipment support</option><option>Dedicated hub movement</option><option>Inter-hub movement</option><option>Hybrid use</option></select></label>
        <label>Project/Ops POC<input name="poc" placeholder="Responsible POC" required /></label>
        {!canDeploy && <span className="form-note">Add a client with mapped hubs and at least one parking source, then choose a vehicle and set deploy time.</span>}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="primary-action" type="submit" disabled={!canDeploy}><Plus size={18} /> Save Deployment</button>
          <button className="ghost-action" type="button" disabled={!selectedVehicleId || !hasClientDeployment(selectedVehicle)} onClick={async () => {
            if (!selectedVehicleId) return;
            const ok = await (removeDeploymentNow ? removeDeploymentNow(selectedVehicleId) : null);
            if (ok) {
              // optionally refresh client list/ui handled by parent
            }
          }}>End deployment only</button>
        </div>
      </form>
      <div className="wide-panel">
        <div className="panel-title">
          <h2>Reusable Client Directory</h2>
          <button className="primary-action compact-action" type="button" onClick={() => setClientModalOpen(true)}><Plus size={18} /> Add Client</button>
        </div>
        <div className="hub-directory">
          {clientHubs.map((item) => {
            const clientHubsList = normalizeLocationRecords(item.hubs);
            return (
              <article key={item.client}>
                <strong>{item.client}</strong>
                <span>GST: {safeValue(item.gstNumber, 'Not added')} | POC: {safeValue(item.clientPoc, 'Not added')}</span>
                <span>{clientHubsList.length} hubs</span>
              </article>
            );
          })}
          {!clientHubs.length && <div className="empty-state">No clients saved yet.</div>}
        </div>
      </div>
      <form className="ops-form remove-deployment-form" onSubmit={removeDeployment}>
        <h2>Remove Vehicle From Client</h2>
        <label>Deployed vehicle<select name="vehicle" required>{deployedVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.id} - {vehicle.client}</option>)}</select></label>
        <label>Removal reason<input name="reason" placeholder="Completed, returned, reassigned..." /></label>
        {!deployedVehicles.length && <span className="form-note">Deploy a vehicle to a client before removing it.</span>}
        <button className="primary-action" type="submit" disabled={!deployedVehicles.length}>Remove Deployment</button>
      </form>
      {clientModalOpen && <ClientOnboardingModal addClient={handleAddClient} closeModal={() => setClientModalOpen(false)} />}
    </section>
  );
}

function ClientOnboardingModal({ addClient, closeModal }) {
  const [poc, setPoc] = useState({ name: '', email: '', phone: '' });
  const [hubs, setHubs] = useState([{ name: '', gmpLink: '' }]);

  const updateHub = (index, patch) => setHubs((current) => current.map((hub, itemIndex) => (itemIndex === index ? { ...hub, ...patch } : hub)));
  const hubPayload = hubs.map((hub) => `${hub.name.trim()} | ${normalizeMapLink(hub.gmpLink)}`).join('\n');
  const pocPayload = [poc.name, poc.email, poc.phone].map((value) => value.trim()).filter(Boolean).join(' | ');

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-card client-hub-form add-client-modal" onSubmit={addClient}>
        <div className="panel-title">
          <h2>Add Client</h2>
          <button className="ghost-action compact-action" type="button" onClick={closeModal}><X size={17} /> Close</button>
        </div>
        <label>GST number<input name="gstNumber" placeholder="Client GST number" required /></label>
        <label>Client name<input name="client" placeholder="Client name" required /></label>
        <div className="poc-grid">
          <label>POC name<input name="pocName" value={poc.name} onChange={(event) => setPoc((current) => ({ ...current, name: event.target.value }))} placeholder="Contact person" required /></label>
          <label>POC email<input name="pocEmail" value={poc.email} onChange={(event) => setPoc((current) => ({ ...current, email: event.target.value }))} type="email" placeholder="name@company.com" required /></label>
          <label>POC phone<input name="pocPhone" value={poc.phone} onChange={(event) => setPoc((current) => ({ ...current, phone: event.target.value }))} type="tel" placeholder="+91 98765 XXXXX" pattern="[0-9+()\\-\\s]{7,20}" required /></label>
        </div>
        <input type="hidden" name="clientPoc" value={pocPayload} readOnly />
        <input type="hidden" name="hubs" value={hubPayload} />
        <input type="hidden" name="parkings" value="" />
        <div className="location-editor">
          <div className="location-editor-title">
            <strong>Hubs</strong>
            <button className="ghost-action compact-action" type="button" onClick={() => setHubs((current) => [...current, { name: '', gmpLink: '' }])}><Plus size={16} /> Add hub</button>
          </div>
          {hubs.map((hub, index) => (
            <LocationEditorCard
              key={`hub-${index}`}
              item={hub}
              label="Hub"
              onChange={(patch) => updateHub(index, patch)}
              canRemove={hubs.length > 1}
              onRemove={() => setHubs((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            />
          ))}
        </div>
        <div className="modal-actions">
          <button className="ghost-action" type="button" onClick={closeModal}>Cancel</button>
          <button className="primary-action" type="submit"><Plus size={18} /> Add Client</button>
        </div>
      </form>
    </div>
  );
}

function LocationEditorCard({ item, label, onChange, canRemove = false, onRemove }) {
  return (
    <article className="location-editor-card">
      <div className="location-editor-fields">
        <label>{label} name<input value={item.name} onChange={(event) => onChange({ name: event.target.value })} placeholder={`${label} name`} required /></label>
        <label>Google Maps link<input value={item.gmpLink} onChange={(event) => onChange({ gmpLink: event.target.value })} placeholder="https://www.google.com/maps/..." required /></label>
      </div>
      <MapLinkPreview link={item.gmpLink} />
      {canRemove && <button className="ghost-action compact-action remove-location" type="button" onClick={onRemove}><X size={16} /> Remove</button>}
    </article>
  );
}

function MapLinkPreview({ link }) {
  const info = mapLinkInfo(link);
  if (!String(link || '').trim()) {
    return <div className="map-link-preview empty">Paste a Google Maps link to preview.</div>;
  }
  if (!info.valid) {
    return (
      <div className="map-link-preview invalid">
        <CircleAlert size={16} />
        <span>{info.message}</span>
      </div>
    );
  }
  const src = `https://www.google.com/maps?q=${info.coords.lat},${info.coords.lng}&z=16&output=embed`;
  return (
    <div className="map-link-preview valid">
      <iframe title="Google Maps preview" src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      <span><MapPin size={15} /> {info.coords.lat.toFixed(5)}, {info.coords.lng.toFixed(5)}</span>
    </div>
  );
}

function DriverAssignments({ assignments, assignDriver, driverSession, selected, vehicles }) {
  return (
    <section className="assignment-layout">
      <div className="table-panel">
        <div className="panel-title">
          <h2>Driver Assignments</h2>
          <span>{assignments.filter((driver) => driver.status === 'Assigned').length} waiting for confirmation</span>
        </div>
        <form className="inline-form" onSubmit={assignDriver}>
          <label>Driver<input name="driver" placeholder="Driver name" required /></label>
          <label>Login email<input name="email" type="email" placeholder="driver@fitsol.green" required /></label>
          <label>Vehicle<select name="vehicle">{vehicles.map((vehicle) => <option key={vehicle.id}>{vehicle.id}</option>)}</select></label>
          <label>Date<input name="date" type="date" defaultValue="2026-05-06" required /></label>
          <label>Shift<input name="shift" placeholder="9:00 AM - 6:00 PM" required /></label>
          <button className="primary-action" type="submit"><UserRound size={18} /> Assign Driver</button>
        </form>
        <DataTable
          columns={['Driver', 'Login email', 'Vehicle', 'Shift', 'Status']}
          rows={assignments.map((driver) => [driver.name, driver.email, driver.vehicle, driver.shift, driver.status])}
        />
      </div>
      <div className="driver-card">
        <h3>Driver mobile view</h3>
        <p>Today&apos;s assigned vehicle</p>
        <strong>{selected.id}</strong>
        <span>{selected.hub} · {selected.parking}</span>
        <mark>{driverSession}</mark>
      </div>
    </section>
  );
}

function ParkingManager({ parkings, addParking }) {
  const [name, setName] = useState('');
  const [gmpLink, setGmpLink] = useState('');

  function handleAdd(event) {
    event.preventDefault();
    if (!name) return;
    addParking({ name: name.trim(), gmpLink: gmpLink.trim() });
    setName(''); setGmpLink('');
  }

  return (
    <section className="table-panel">
      <div className="panel-title">
        <h2>Parking sites</h2>
        <span>{parkings.length} parking site(s)</span>
      </div>
      <form className="inline-form" onSubmit={handleAdd}>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Parking name" required /></label>
        <label>Google Maps link<input value={gmpLink} onChange={(e) => setGmpLink(e.target.value)} placeholder="https://maps.google.com/..." /></label>
        <button className="primary-action" type="submit"><Plus size={16} /> Add Parking</button>
      </form>
      <div className="parking-list">
        {parkings.map((p) => (
          <article key={p.id} className="task-card">
            <div>
              <strong>{p.name}</strong>
              <p>{p.gmpLink ? <a href={p.gmpLink} target="_blank" rel="noreferrer">link</a> : 'No map link'}</p>
            </div>
          </article>
        ))}
        {!parkings.length && <div className="empty-state">No parking sites added yet.</div>}
      </div>
    </section>
  );
}

function OpsActionCenter({ tasks, markTaskDone, selectVehicle, openFleet }) {
  return (
    <section className="table-panel">
      <div className="panel-title">
        <h2>Ops Action Center</h2>
        <span>{tasks.filter((task) => task.status === 'Pending').length} pending</span>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <article className="task-card" key={task.id}>
            <div>
              <h3>{task.title}</h3>
              <p>{task.vehicle} · {task.client} · {task.hub}</p>
              <span>{task.parking} · {task.poc} · Due {task.due}</span>
            </div>
            <div className="task-actions">
              <button type="button" onClick={() => { selectVehicle(task.vehicle); openFleet(); }}><MapPin size={17} /> Track vehicle</button>
              <button type="button" disabled={task.status === 'Done'} onClick={() => markTaskDone(task.id)}><Check size={17} /> {task.status === 'Done' ? 'Done' : 'Mark done'}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Reports({ vehicles, range, validateRange, rangeError, exportReport }) {
  return (
    <section className="table-panel">
      <div className="panel-title">
        <h2>Client-wise Reports</h2>
        <button className="primary-action" onClick={exportReport} type="button"><FileSpreadsheet size={18} /> Download CSV</button>
      </div>
      <div className="report-controls">
        <label>From<input type="date" value={range.from} onChange={(event) => validateRange({ ...range, from: event.target.value })} /></label>
        <label>To<input type="date" value={range.to} onChange={(event) => validateRange({ ...range, to: event.target.value })} /></label>
        {rangeError && <strong>{rangeError}</strong>}
      </div>
      <DataTable
        columns={['Vehicle', 'Client', 'Hub', 'Driver', 'Distance', 'Running time', 'Battery', 'Carbon', 'Confidence']}
        rows={vehicles.map((vehicle) => [vehicle.id, vehicle.client, vehicle.hub, vehicle.driver, `${vehicle.todayDistance} km`, ensureRunningTime(vehicle.runningTime, vehicle.todayDistance), `${vehicle.battery}%`, vehicle.carbon, vehicle.confidence])}
      />
    </section>
  );
}

function AlertsPanel() {
  const [state, setState] = useState({ loading: true, alerts: [], recipients: [], thresholds: null, error: '' });
  const [sending, setSending] = useState(false);

  async function loadPreview() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const payload = await apiJson('/api/alerts/preview');
      if (payload.setupNeeded) throw new Error(payload.message || payload.error || 'Alert setup needed');
      setState({ loading: false, alerts: payload.alerts || [], recipients: payload.recipients || [], thresholds: payload.thresholds, previousDate: payload.previousDate, error: '' });
    } catch (error) {
      setState({ loading: false, alerts: [], recipients: [], thresholds: null, error: error.message });
    }
  }

  async function sendAlerts() {
    setSending(true);
    try {
      const payload = await apiJson('/api/alerts/send', { method: 'POST' });
      setState((current) => ({ ...current, sentMessage: payload.message || `Sent to ${payload.sent} recipient(s) for ${payload.vehicles || 0} vehicle(s). Delivery: ${payload.delivery?.mode || 'none'}` }));
    } catch (error) {
      setState((current) => ({ ...current, sentMessage: error.message }));
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    loadPreview();
  }, []);

  return (
    <section className="table-panel">
      <div className="panel-title">
        <div>
          <h2>Movement Alert Emails</h2>
          <p>Deployed vehicles are flagged when previous-day distance is below the configured km threshold.</p>
        </div>
        <div className="task-actions">
          <button type="button" onClick={loadPreview}><RefreshCw size={17} /> Preview</button>
          <button type="button" onClick={sendAlerts} disabled={sending || state.loading}><Send size={17} /> {sending ? 'Sending' : 'Send Mail'}</button>
        </div>
      </div>
      {state.error && <div className="setup-warning">Setup needed: {state.error}. Add tab "{'Alert Recipients'}" with headers: name, email, role, active.</div>}
      {state.sentMessage && <div className="toast">{state.sentMessage}</div>}
      <div className="alert-summary">
        <MetricMini icon={Mail} label="Recipients" value={state.recipients.length} />
        <MetricMini icon={CircleAlert} label="Vehicles flagged" value={state.alerts.length} />
        <MetricMini icon={Calendar} label="Alert date" value={state.previousDate || 'Previous day'} />
      </div>
      <DataTable
        columns={['Vehicle', 'Client', 'Hub', 'Status', 'Distance', 'Running time', 'Battery', 'Reason', 'Last updated']}
        rows={state.alerts.map((alert) => [alert.vehicle, alert.client || 'Unassigned', alert.hub || 'Unassigned', alert.status, `${alert.distanceTodayKm} km`, `${alert.runningMinutes} min`, `${alert.batteryPercent}%`, alert.reasons.join('; '), alert.lastUpdated])}
      />
    </section>
  );
}

function SettingsPanel({ settingsState, saveSettings }) {
  return (
    <section className="form-grid">
      <form className="ops-form" onSubmit={saveSettings}>
        <h2>Alerts & Carbon Settings</h2>
        <label>Good charge threshold (%)<input name="goodCharge" type="number" defaultValue={settingsState.goodCharge} min="1" max="100" required /></label>
        <label>Minimum movement per day (km)<input name="minDistance" type="number" step="0.1" defaultValue={settingsState.minDistance} min="0" required /></label>
        <label>Minimum running time (minutes)<input name="minRunTime" type="number" defaultValue={settingsState.minRunTime} min="0" required /></label>
        <label>Electricity emission factor<input name="electricityFactor" type="number" step="0.01" defaultValue={settingsState.electricityFactor} min="0" required /></label>
        <label>CNG emission factor<input name="cngFactor" type="number" step="0.01" defaultValue={settingsState.cngFactor} min="0" required /></label>
        <label>CNG consumption estimate (kg/km)<input name="cngConsumption" type="number" step="0.01" defaultValue={settingsState.cngConsumption} min="0" required /></label>
        <label>EV energy fallback (kWh/km)<input name="evEnergy" type="number" step="0.01" defaultValue={settingsState.evEnergy} min="0" required /></label>
        <button className="primary-action" type="submit"><Settings size={18} /> Save Settings</button>
      </form>
      <div className="wide-panel">
        <h2>Configured Outcome</h2>
        <div className="summary-list">
          <span>Deployed vehicles below {settingsState.minDistance} km movement are eligible for unused-vehicle alerts.</span>
          <span>Running time is shown in alert details, but distance is the trigger.</span>
          <span>Carbon savings compare EV electricity against CNG: electricity {settingsState.electricityFactor} kgCO2e/kWh, EV fallback {settingsState.evEnergy} kWh/km, CNG {settingsState.cngFactor} kgCO2e/kg, consumption {settingsState.cngConsumption} kg/km.</span>
        </div>
      </div>
    </section>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <article className="metric-card">
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function MetricMini({ icon: Icon, label, value }) {
  return (
    <article className="metric-mini">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function apiFetch(url, options = {}) {
  return fetch(url, {
    credentials: 'include',
    ...options,
  });
}

async function apiJson(url, options = {}) {
  if (supabaseDirectEnabled && String(url || '').startsWith('/api/')) {
    return supabaseApiJson(url, options);
  }
  const response = await apiFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  // Some upstream failures (proxy down, auth redirects, etc.) may return HTML.
  // Read as text and then attempt JSON parse so we can surface a helpful message.
  const raw = await response.text().catch(() => '');
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const message = payload.error || payload.message;
    if (message) throw new Error(message);
    if (raw && raw.trim().startsWith('<!DOCTYPE')) {
      throw new Error('Backend returned an HTML error page. Make sure the API server is running (port 3001) and you are signed in.');
    }
    throw new Error(`Request failed (${response.status})`);
  }
  return payload;
}

async function loadProductionVehicles() {
  const apiUrl = import.meta.env.VITE_FLEET_DATA_API_URL || '/api/fleet';
  const csvUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL;

  if (apiUrl) {
    const payload = String(apiUrl).startsWith('/api/')
      ? await apiJson(apiUrl)
      : await fetch(apiUrl, { headers: { Accept: 'application/json' } }).then((response) => {
          if (!response.ok) throw new Error(`API ${response.status}`);
          return response.json();
        });
    const rows = Array.isArray(payload) ? payload : (payload.vehicles || []);
    const alreadyNormalized = (rows || []).every((row) => (
      row.id
      && (
        row.todayDistance !== undefined
        || row.runningTime !== undefined
        || row.avgSpeed !== undefined
        || row.lastStop !== undefined
        || row.lastUpdated !== undefined
      )
    ));
    if (alreadyNormalized) return rows;
    return normalizeVehicleRows(rows || []);
  }

  if (csvUrl) {
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error(`Sheet CSV ${response.status}`);
    const text = await response.text();
    return normalizeVehicleRows(parseCsv(text));
  }

  return [];
}

function normalizeVehicleRows(rows) {
  return rows.map((row, index) => {
    const rawPayload = objectValue(row.raw_payload);
    const metadata = objectValue(row.metadata);
    const sources = [rawPayload, metadata, row].filter(Boolean);
    const get = (...keys) => {
      for (const key of keys) {
        for (const source of sources) {
          const value = source[key] ?? source[toSnake(key)] ?? source[toTitle(key)] ?? source[key.toLowerCase()];
          if (value !== undefined && value !== null && String(value).trim() !== '') return value;
        }
      }
      return '';
    };
    const vehicleNumber = String(get('vehicle_number', 'Vehcile_no', 'vehicle_no', 'Vehicle number', 'Vehicle No', 'vehicle', 'registration', 'id')).trim();
    const lat = Number(get('latitude', 'lat', 'Current location latitude'));
    const lng = Number(get('longitude', 'lng', 'lon', 'Current location longitude'));
    const todayDistance = Number(get('todayDistance', 'today_distance', 'distance_today_km', 'Dist._today', 'distance_today', 'Distance covered today', 'Distance covered')) || 0;
    const rawRunningTime = get('runningTime', 'running_time', 'today_running_minutes', 'time today', 'Running time today');
    const runningTime = ensureRunningTime(formatRunningTimeLabel(rawRunningTime), todayDistance);
    const avgSpeed = ensureAverageSpeed(
      formatUnitValue(get('avgSpeed', 'avg_speed', 'today_avg_speed_kmph', 'average speed(calculated from distance and time)', 'average_speed', 'Average speed today'), 'km/h'),
      todayDistance,
      rawRunningTime,
    );
    return {
      id: vehicleNumber || `EV-${index + 1}`,
      model: get('model', 'vehicle_model', 'vehicleModel', 'vehicle model/model', 'Vehicle model', 'Make model') || '',
      sourceSystem: get('sourceSystem', 'source_system', 'source', 'Source system') || '',
      client: get('client', 'Client') || 'Unassigned client',
      hub: get('hub', 'Client hub', 'Hub') || 'Unassigned hub',
      parking: get('parking', 'Parking location') || 'Parking unavailable',
      status: normalizeStatus(get('status', 'movement_status_raw', 'current status of vehicle', 'Live status', 'Current status')),
      battery: Number(get('battery', 'battery_percent', 'battery%', 'Current battery charge', 'soc')) || 0,
      distance: Number(get('distance_left', 'Distance left')) || 0,
      todayDistance,
      runningTime,
      avgSpeed,
      temp: get('temperature', 'battery_temperature_c', 'Temperature') || 'Unavailable',
      odometer: formatUnitValue(get('odometer', 'odometer_km', 'Odometer'), 'km'),
      energy: formatUnitValue(get('energy', 'energy_today_kwh', 'energy consumed', 'Energy consumed today'), 'kWh'),
      eta: get('eta', 'Estimated Time of Arrival') || 'Unavailable',
      etaDate: get('eta_date', 'ETA date') || '06-05-2026',
      lastUpdated: get('lastUpdated', 'last_updated', 'scraped_at', 'created_at', 'Last updated', 'Vehicle updated timestamp') || 'Unavailable',
      driverState: get('driverState', 'driver_state') || 'none',
      driver: get('driver', 'Active driver', 'Assigned driver', 'Last driver') || 'No driver confirmed yet',
      driverMeta: get('driverMeta', 'driver_meta') || 'Loaded from production source',
      route: get('route', 'Route') || 'Route unavailable',
      location: get('location', 'Current location text') || 'Location unavailable',
      lastStop: get('lastStop', 'last_stop', 'last_stop_location_text', 'last stop', 'Last stop text address') || 'Last stop unavailable',
      carbon: get('carbon', 'Carbon saved vs CNG') || 'Unavailable',
      confidence: get('carbon_confidence', 'Carbon confidence') || 'Unavailable',
      stops: Array.isArray(row.stops) ? row.stops : stopHistoryFromRawRow(row, rawPayload || metadata),
      hubGmpLink: get('hub_gmp_link', 'Hub GMP Link', 'Hub Google Maps link') || '',
      hubLat: Number(get('hub_lat', 'Hub Lat')) || undefined,
      hubLng: Number(get('hub_lng', 'Hub Lng')) || undefined,
      parkingGmpLink: get('parking_gmp_link', 'Parking GMP Link', 'Parking Google Maps link') || '',
      parkingLat: Number(get('parking_lat', 'Parking Lat')) || undefined,
      parkingLng: Number(get('parking_lng', 'Parking Lng')) || undefined,
      lat,
      lng,
      x: 34 + (index % 8) * 6,
      y: 38 + (index % 5) * 8,
    };
  });
}

function normalizeStatus(value) {
  const status = String(value || '').toLowerCase();
  if (status.includes('run') || status.includes('moving')) return 'Running';
  if (status.includes('charg')) return 'Charging';
  if (status.includes('offline') || status.includes('stale')) return 'Offline';
  return 'Idle';
}

function safeValue(value, fallback = 'Not available') {
  const text = String(value ?? '').trim();
  return text && !['Unavailable', 'undefined', 'null', 'NaN'].includes(text) ? text : fallback;
}

function parseLocationLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => {
      const [name = '', gmpLink = ''] = line.trim().split('|').map((part) => part.trim());
      return { name, gmpLink };
    })
    .filter((item) => item.name || item.gmpLink);
}

function parseCarbonKg(value) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function numberFromValue(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function objectValue(value) {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stopHistoryFromRawRow(row = {}, raw = {}) {
  const location = row.lastStop || row.last_stop_location_text || row.last_stop || raw?.['last stop'] || raw?.last_stop_location_text || '';
  if (!location) return [];
  const distanceTodayKm = numberFromValue(row.todayDistance ?? row.distance_today_km ?? raw?.['Dist._today'] ?? row.today_distance);
  const runningTime = ensureRunningTime(
    row.runningTime || formatRunningTimeLabel(row.today_running_minutes ?? raw?.['time today'] ?? row.running_time),
    distanceTodayKm,
  );
  return [{
    location,
    scrapedAt: row.lastUpdated || row.scraped_at || raw?.scraped_at || row.last_updated || '',
    distanceTodayKm,
    runningTime,
    status: normalizeStatus(row.movement_status_raw || raw?.['current status of vehicle'] || row.status),
  }];
}

function formatUnitValue(value, unit, fallback = 'Unavailable') {
  const text = String(value ?? '').trim();
  if (!text || ['Unavailable', 'undefined', 'null', 'NaN'].includes(text)) return fallback;
  if (/[a-z%]/i.test(text)) return text;
  const number = numberFromValue(text);
  return Number.isFinite(number) ? `${formatNumber(number)} ${unit}` : text;
}

function formatRunningTimeLabel(value) {
  const text = String(value ?? '').trim();
  if (!text || ['Unavailable', 'undefined', 'null', 'NaN'].includes(text)) return 'Unavailable';
  const minutes = minutesFromRunningTime(text);
  if (!minutes) return text;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatIndiaTimestamp(value) {
  const date = parseTelemetryDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isWithinDayRange(value, days) {
  const date = parseTelemetryDate(value);
  if (!date) return true;
  const rangeMs = Number(days) * 24 * 60 * 60 * 1000;
  return Date.now() - date.getTime() <= rangeMs;
}

function parseTelemetryDate(value) {
  const text = String(value || '').trim();
  if (!text || /^unavailable$/i.test(text)) return null;
  const normalized = text
    .replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T')
    .replace(/([+-]\d\d)$/, '$1:00');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parkingLocationsFor(clientHubs = [], parkings = []) {
  const clientParkingLocations = (clientHubs || [])
    .flatMap((client) => normalizeLocationRecords(client.parkings))
    .map((parking) => coordsFromFields(parking.lat, parking.lng) || extractMapCoords(parking.gmpLink))
    .filter(Boolean);
  const globalParkingLocations = (parkings || [])
    .map((parking) => coordsFromFields(parking.lat, parking.lng) || extractMapCoords(parking.gmpLink))
    .filter(Boolean);
  return [...clientParkingLocations, ...globalParkingLocations];
}

function countVehiclesAtParking(vehicles = [], clientHubs = [], parkings = []) {
  const parkingLocations = parkingLocationsFor(clientHubs, parkings);
  if (!parkingLocations.length) return 0;
  return vehicles.filter((vehicle) => {
    const vehicleCoords = coordsFromFields(vehicle.lat, vehicle.lng);
    if (!vehicleCoords) return false;
    return parkingLocations.some((parking) => distanceMeters(vehicleCoords, parking) <= 100);
  }).length;
}

function modelLabelFor(vehicle) {
  return safeValue(vehicle?.model || vehicle?.vehicleModel || vehicle?.sourceSystem, 'Unspecified model');
}

function uniqueOptions(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function hasClientDeployment(vehicle) {
  return Boolean(
    vehicle?.hubGmpLink
    || vehicle?.parkingGmpLink
    || (safeValue(vehicle?.hub, '') && safeValue(vehicle?.hub, '') !== 'Unassigned hub' && safeValue(vehicle?.parking, '') !== 'Parking unavailable')
  );
}

function isCurrentDriverAssignment(assignment) {
  const status = String(assignment?.status || '').trim().toLowerCase();
  const session = String(assignment?.sessionState || assignment?.session_state || '').trim().toLowerCase();
  return !(
    status.includes('replaced')
    || status.includes('ended')
    || status.includes('removed')
    || status.includes('unassigned')
    || session.includes('ended')
  );
}

function canScheduleVehicleForDeployment(vehicle) {
  // allow scheduling for any vehicle; if vehicle is running or already deployed,
  // frontend will ask for previous undeploy time before creating a new deployment.
  return Boolean(vehicle);
}

function deploymentStatusLabel(vehicle) {
  if (!vehicle) return 'No vehicle selected';
  if (hasClientDeployment(vehicle)) return `Deployed to ${safeValue(vehicle.client, 'client')}`;
  if (vehicle.status === 'Offline') return 'Offline';
  return `${safeValue(vehicle.status, 'Unknown status')} - not eligible`;
}

function normalizeClientName(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeMapScopeName(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeDriverPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeLicenseNumber(value) {
  return String(value || '').trim().toLowerCase();
}

function findDuplicateDriverMessage(drivers = [], candidate = {}, excludeDriverId = '') {
  const candidatePhone = normalizeDriverPhone(candidate.phone);
  const candidateEmail = normalizeClientName(candidate.email);
  const candidateLicense = normalizeLicenseNumber(candidate.licenseNumber);
  const excludeId = String(excludeDriverId || '').trim();
  const duplicate = (drivers || []).find((driver) => {
    const driverId = String(driver.driverId || driver.id || '').trim();
    if (excludeId && driverId === excludeId) return false;
    return (
      (candidatePhone && normalizeDriverPhone(driver.phone) === candidatePhone)
      || (candidateEmail && normalizeClientName(driver.email) === candidateEmail)
      || (candidateLicense && normalizeLicenseNumber(driver.licenseNumber) === candidateLicense)
    );
  });
  if (!duplicate) return '';
  if (candidatePhone && normalizeDriverPhone(duplicate.phone) === candidatePhone) return 'A driver with this contact number already exists.';
  if (candidateEmail && normalizeClientName(duplicate.email) === candidateEmail) return 'A driver with this email already exists.';
  if (candidateLicense && normalizeLicenseNumber(duplicate.licenseNumber) === candidateLicense) return 'A driver with this license number already exists.';
  return 'This driver already exists.';
}

function normalizeLocationRecords(records = []) {
  return records.map((item) => (typeof item === 'string' ? { name: item, gmpLink: '' } : item)).filter((item) => item?.name);
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}%` : 'Not available';
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0';
}

function formatOdometer(value) {
  const text = safeValue(value);
  const match = text.match(/-?\d+(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/);
  if (!match) return text;
  const number = Number(match[0].replace(/,/g, ''));
  if (!Number.isFinite(number)) return text;
  return `${number.toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
}

const reverseGeocodeCache = new Map();

function useNearPlaceLabel(lat, lng) {
  const coordsKey = Number.isFinite(lat) && Number.isFinite(lng) ? `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}` : '';
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!coordsKey) return;
    const cached = reverseGeocodeCache.get(coordsKey);
    if (cached) {
      setLabel(cached);
      return;
    }
    let cancelled = false;
    apiJson(`/api/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`)
      .then((payload) => payload.place || '')
      .then((place) => {
        if (cancelled) return;
        const formatted = place ? `Near ${place}` : '';
        reverseGeocodeCache.set(coordsKey, formatted);
        setLabel(formatted);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [coordsKey, lat, lng]);

  return label;
}

function formatRelativeTimestamp(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/ago$/i.test(text) || /^just now$/i.test(text) || /^unavailable$/i.test(text)) return text;
  const time = new Date(text).getTime();
  if (!Number.isFinite(time) || time <= 0) return text;
  return relativeTimeFromNow(time);
}

function relativeTimeFromNow(timeMs) {
  const diff = Date.now() - timeMs;
  if (!Number.isFinite(diff)) return '';
  const seconds = Math.max(0, Math.floor(diff / 1000));
  if (seconds < 60) return 'less than a minute ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function ensureAverageSpeed(avgSpeedValue, todayDistanceValue, runningTimeValue) {
  const avgSpeedText = String(avgSpeedValue || '').trim();
  const distanceKm = numberFromValue(todayDistanceValue);
  const minutes = minutesFromRunningTime(runningTimeValue);
  if (distanceKm > 0 && !minutes) return `${assumedAverageSpeedKmph} km/h`;
  const avgSpeedNumber = numberFromValue(avgSpeedText);
  if (avgSpeedNumber > 0 && !/unavailable/i.test(avgSpeedText) && !/nan/i.test(avgSpeedText)) return avgSpeedText;
  if (!distanceKm || !minutes) return avgSpeedText || 'Not available';
  const hours = minutes / 60;
  if (!hours) return avgSpeedText || 'Not available';
  const kmph = distanceKm / hours;
  if (!Number.isFinite(kmph) || kmph <= 0) return avgSpeedText || 'Not available';
  return `${formatNumber(kmph)} km/h`;
}

function ensureRunningTime(runningTimeValue, todayDistanceValue) {
  const minutes = minutesFromRunningTime(runningTimeValue);
  if (minutes > 0) return formatMinutesDuration(minutes);
  const distanceKm = numberFromValue(todayDistanceValue);
  if (distanceKm > 0) return formatMinutesDuration((distanceKm / assumedAverageSpeedKmph) * 60);
  const text = String(runningTimeValue || '').trim();
  return text && !/unavailable/i.test(text) && !/nan/i.test(text) ? text : 'Not available';
}

function formatMinutesDuration(minutesValue) {
  const minutes = Number(minutesValue);
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Not available';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function minutesFromRunningTime(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).toLowerCase();
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric;
  // Try to parse strings like "120 min", "2 hours", "1h 30m".
  let minutes = 0;
  const hrMatch = text.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hrMatch) minutes += Number(hrMatch[1]) * 60;
  const hourWord = text.match(/(\d+(?:\.\d+)?)\s*hour/);
  if (hourWord) minutes += Number(hourWord[1]) * 60;
  const minMatch = text.match(/(\d+(?:\.\d+)?)\s*m(?![a-z])/);
  if (minMatch) minutes += Number(minMatch[1]);
  const minWord = text.match(/(\d+(?:\.\d+)?)\s*min/);
  if (minWord) minutes += Number(minWord[1]);
  return Number.isFinite(minutes) ? minutes : 0;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift()?.map((header) => header.trim()) || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ''])));
}

function toSnake(value) {
  return String(value).replace(/\s+/g, '_').toLowerCase();
}

function toTitle(value) {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function canAccess(user, permission) {
  if (!user) return false;
  if (!permission) return true;
  const permissions = user.permissions || [];
  if (permissions.includes('all')) return true;
  if (Array.isArray(permission)) return permission.some((item) => permissions.includes(item));
  return permissions.includes(permission);
}

createRoot(document.getElementById('root')).render(<App />);
