import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BatteryCharging,
  Calendar,
  Car,
  Check,
  CircleAlert,
  Download,
  FileSpreadsheet,
  Gauge,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Navigation,
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
  Zap,
} from 'lucide-react';
import './styles.css';

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
  Driver: 'driver',
  Operations: ['deployments', 'drivers', 'tasks'],
  Reports: 'reports',
  Admin: ['alerts', 'all'],
};

const primaryTabs = ['Overview', 'EV Fleet', 'Clients', 'Reports', 'Operations', 'Admin'];

function App() {
  const [activeTab, setActiveTab] = useState('EV Fleet');
  const [vehicles, setVehicles] = useState(vehiclesSeed);
  const [dataSourceStatus, setDataSourceStatus] = useState('Using demo data. Configure production Sheet/API endpoint to load live fleet telemetry.');
  const [selectedId, setSelectedId] = useState('TN77T5990');
  const [tasks, setTasks] = useState(initialTasks);
  const [driverAssignments, setDriverAssignments] = useState(driverSeed);
  const [clientHubs, setClientHubs] = useState(clientHubSeed);
  const initialParkingSeed = (() => {
    const names = Array.from(new Set(vehiclesSeed.map((v) => v.parking).filter(Boolean)));
    return names.map((name, idx) => ({ id: `P${idx + 1}`, name, totalSpaces: 10, spacesLeft: 10, gmpLink: '' }));
  })();
  const [parkings, setParkings] = useState(initialParkingSeed);
  const [driverSession, setDriverSession] = useState('Ready');
  const [settingsState, setSettingsState] = useState({
    goodCharge: 70,
    minDistance: 1,
    minRunTime: 10,
    electricityFactor: 0.72,
    cngFactor: 2.75,
    cngConsumption: 0.18,
    evEnergy: 0.22,
  });
  const [statusFilter, setStatusFilter] = useState('Active');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState('All statuses');
  const [modelFilter, setModelFilter] = useState('All models');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState({ from: '2026-04-29', to: '2026-05-06' });
  const [rangeError, setRangeError] = useState('');
  const [toast, setToast] = useState('');
  const [auth, setAuth] = useState({ user: null, authRequired: false, loading: true });
  const [mapConfig, setMapConfig] = useState({ enabled: false, apiKey: '', mapId: '', missing: { apiKey: true, mapId: true } });
  const [loginEmail, setLoginEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');

  function addParking({ name, totalSpaces, gmpLink }) {
    setParkings((current) => {
      if (current.some((p) => p.name === name)) return current;
      const coords = extractMapCoords(gmpLink) || null;
      const newItem = {
        id: `P${current.length + 1}`,
        name,
        totalSpaces: Number(totalSpaces) || 0,
        spacesLeft: Number(totalSpaces) || 0,
        gmpLink: gmpLink || '',
        lat: coords?.lat,
        lng: coords?.lng,
      };
      return [newItem, ...current];
    });
  }

  function updateParkingSpaces(name, nextSpaces) {
    setParkings((current) => current.map((p) => (p.name === name ? { ...p, totalSpaces: Number(nextSpaces) || 0, spacesLeft: Math.min(Number(nextSpaces) || 0, Number(p.spacesLeft) || 0) } : p)));
  }

  const selected = vehicles.find((vehicle) => vehicle.id === selectedId) || vehicles[0];

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
    fetch('/api/auth/me')
      .then(async (response) => {
        if (!response.ok) throw new Error('Not signed in');
        return response.json();
      })
      .then((payload) => setAuth({ user: payload.user, authRequired: payload.authRequired, loading: false }))
      .catch(() => setAuth({ user: null, authRequired: true, loading: false }));
  }, []);

  useEffect(() => {
    fetch('/api/config')
      .then((response) => response.json())
      .then((payload) => setMapConfig(payload.googleMaps || { enabled: false, apiKey: '', mapId: '', missing: { apiKey: true, mapId: true } }))
      .catch(() => setMapConfig({ enabled: false, apiKey: '', mapId: '', missing: { apiKey: true, mapId: true } }));
  }, []);

  useEffect(() => {
    if (auth.loading || !auth.user || !canAccess(auth.user, 'fleet')) return;
    fetch('/api/client-hubs')
      .then(async (response) => {
        if (!response.ok) throw new Error('Client hub sheet unavailable');
        return response.json();
      })
      .then((payload) => {
        if (payload.clients?.length) setClientHubs(payload.clients);
      })
      .catch(() => {});
  }, [auth.loading, auth.user]);

  const visibleTabs = useMemo(() => primaryTabs.filter((tab) => canAccess(auth.user, tabPermissions[tab])), [auth.user]);
  const modelOptions = useMemo(() => uniqueOptions(vehicles.map(modelLabelFor)), [vehicles]);
  const vehicleStatusOptions = useMemo(() => uniqueOptions(vehicles.map((vehicle) => vehicle.status)), [vehicles]);
  const activeVehicleCount = vehicles.filter((vehicle) => vehicle.status !== 'Offline').length;
  const offlineVehicleCount = vehicles.filter((vehicle) => vehicle.status === 'Offline').length;

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
      const matchesVehicleStatus = vehicleStatusFilter === 'All statuses' || vehicle.status === vehicleStatusFilter;
      const matchesModel = modelFilter === 'All models' || modelLabelFor(vehicle) === modelFilter;
      return matchesQuery && matchesStatusGroup && matchesVehicleStatus && matchesModel;
    });
  }, [vehicles, query, statusFilter, vehicleStatusFilter, modelFilter]);

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
    if (!hubs.length || !parkings.length) {
      setToast('Add at least one hub and one parking point.');
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
    if (hubs.some((hub) => !extractMapCoords(hub.gmpLink))) {
      setToast('Use Google Maps links that include coordinates for each hub.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    if (parkings.some((parking) => !extractMapCoords(parking.gmpLink))) {
      setToast('Use Google Maps links that include coordinates for each parking point.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    const response = await fetch('/api/client-hubs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client,
        gstNumber,
        clientPoc,
        hubs: hubs.map((hub) => `${hub.name} | ${hub.gmpLink}`).join('\n'),
        parkings: parkings.map((parking) => `${parking.name} | ${parking.gmpLink}`).join('\n'),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setToast(payload.error || payload.message || 'Unable to save client hubs.');
      window.setTimeout(() => setToast(''), 2600);
      return false;
    }
    setClientHubs(payload.clients || []);
    formElement.reset();
    setToast('Client saved for reuse.');
    window.setTimeout(() => setToast(''), 2600);
    return true;
  }

  async function reloadClientHubs() {
    try {
      const response = await fetch('/api/client-hubs');
      if (!response.ok) throw new Error('Unable to load client hubs');
      const payload = await response.json();
      if (payload.clients) setClientHubs(payload.clients);
    } catch (error) {
      // ignore
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
      return;
    }
    if (!canScheduleVehicleForDeployment(existingVehicle)) {
      setToast('Vehicle must be offline or already deployed before scheduling.');
      window.setTimeout(() => setToast(''), 2600);
      return;
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
      return;
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
        }),
      });
      if (payload.task) setTasks((current) => [payload.task, ...current]);
    } catch (error) {
      setToast(error.message || 'Unable to save deployment.');
      window.setTimeout(() => setToast(''), 2600);
      return;
    }
    // decrement spacesLeft for the selected parking if it's managed in global parkings
    setParkings((current) => current.map((p) => (p.name === deployment.parking ? { ...p, spacesLeft: Math.max(0, (p.spacesLeft || 0) - 1) } : p)));

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
            locationState: 'Not assigned to a hub/parking geofence',
            lastUpdated: 'just now',
          }
        : vehicle
    )));
    setToast('Vehicle removed from client deployment.');
    window.setTimeout(() => setToast(''), 2600);
    return true;
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
      vehicle.runningTime,
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
    const response = await fetch('/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setLoginMessage(payload.error || payload.message || 'Unable to send OTP');
      return;
    }
    setOtpSent(true);
    setLoginMessage(payload.devOtp ? `OTP sent. Dev OTP: ${payload.devOtp}` : 'OTP sent to your email.');
  }

  async function verifyOtp(event) {
    event.preventDefault();
    const response = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, otp }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setLoginMessage(payload.error || 'Invalid OTP');
      return;
    }
    setAuth((current) => ({ ...current, user: payload.user }));
    setLoginMessage('');
    setOtp('');
    setOtpSent(false);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuth((current) => ({ ...current, user: current.authRequired ? null : { name: 'Guest Admin', role: 'admin', permissions: ['all'] } }));
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
        {activeTab === 'Overview' && <Overview vehicles={vehicles} tasks={tasks} />}
        {activeTab === 'EV Fleet' && (
          <FleetView
            filteredVehicles={filteredVehicles}
            selected={selected}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            vehicleStatusFilter={vehicleStatusFilter}
            setVehicleStatusFilter={setVehicleStatusFilter}
            vehicleStatusOptions={vehicleStatusOptions}
            modelFilter={modelFilter}
            setModelFilter={setModelFilter}
            modelOptions={modelOptions}
            activeVehicleCount={activeVehicleCount}
            offlineVehicleCount={offlineVehicleCount}
            query={query}
            setQuery={setQuery}
            exportReport={exportReport}
            mapConfig={mapConfig}
            parkings={parkings}
          />
        )}
        {activeTab === 'Clients' && (
          <ClientsHub addClient={addClient} refreshClientHubs={reloadClientHubs} clientHubs={clientHubs} vehicles={vehicles} />
        )}
        
        {activeTab === 'Operations' && (
          <OperationsHub
            addClient={addClient}
            addDeployment={addDeployment}
            removeDeployment={removeDeployment}
            assignments={driverAssignments}
            assignDriver={assignDriver}
            clientHubs={clientHubs}
            driverSession={driverSession}
            markTaskDone={markTaskDone}
            openFleet={() => setActiveTab('EV Fleet')}
            selected={selected}
            selectVehicle={setSelectedId}
            tasks={tasks}
            vehicles={vehicles}
            parkings={parkings}
            addParking={addParking}
            updateParkingSpaces={updateParkingSpaces}
          />
        )}
        {activeTab === 'Reports' && (
          <ReportsHub
            exportReport={exportReport}
            range={range}
            rangeError={rangeError}
            validateRange={validateRange}
            vehicles={vehicles}
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

function OperationsHub({ addClient, addDeployment, removeDeployment, assignments, assignDriver, clientHubs, driverSession, markTaskDone, openFleet, selected, selectVehicle, tasks, vehicles, parkings, addParking, updateParkingSpaces }) {
  return (
    <div className="stacked-workspace">
      <Deployments addClient={addClient} addDeployment={addDeployment} removeDeployment={removeDeployment} removeDeploymentNow={endDeploymentNow} clientHubs={clientHubs} vehicles={vehicles} parkings={parkings} />
      <DriverAssignments
        assignments={assignments}
        assignDriver={assignDriver}
        driverSession={driverSession}
        selected={selected}
        vehicles={vehicles}
      />
      <ParkingManager parkings={parkings} addParking={addParking} updateParkingSpaces={updateParkingSpaces} />
      <OpsActionCenter tasks={tasks} markTaskDone={markTaskDone} selectVehicle={selectVehicle} openFleet={openFleet} />
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

function ReportsHub({ exportReport, range, rangeError, validateRange, vehicles }) {
  return (
    <div className="stacked-workspace">
      <Reports vehicles={vehicles} range={range} validateRange={validateRange} rangeError={rangeError} exportReport={exportReport} />
    </div>
  );
}

function DriverConsole({ assignments, driverSession, setDriverSession }) {
  const activeAssignment = assignments[0];
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

function Overview({ vehicles, tasks }) {
  const running = vehicles.filter((vehicle) => vehicle.status === 'Running').length;
  const pending = tasks.filter((task) => task.status === 'Pending').length;
  const carbonSaved = vehicles.reduce((total, vehicle) => total + parseCarbonKg(vehicle.carbon), 0);
  return (
    <section className="overview-grid">
      <MetricCard icon={Truck} label="Active EVs" value={vehicles.filter((vehicle) => vehicle.status !== 'Offline').length} />
      <MetricCard icon={Zap} label="Running now" value={running} />
      <MetricCard icon={CircleAlert} label="Pending ops tasks" value={pending} />
      <MetricCard icon={Gauge} label="Carbon saved" value={carbonSaved ? `${formatNumber(carbonSaved)} kg` : 'Not available'} />
    </section>
  );
}

function FleetView({ filteredVehicles, selected, selectedId, setSelectedId, statusFilter, setStatusFilter, vehicleStatusFilter, setVehicleStatusFilter, vehicleStatusOptions, modelFilter, setModelFilter, modelOptions, activeVehicleCount, offlineVehicleCount, query, setQuery, exportReport, mapConfig, parkings }) {
  return (
    <>
      <Toolbar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        vehicleStatusFilter={vehicleStatusFilter}
        setVehicleStatusFilter={setVehicleStatusFilter}
        vehicleStatusOptions={vehicleStatusOptions}
        modelFilter={modelFilter}
        setModelFilter={setModelFilter}
        modelOptions={modelOptions}
        activeVehicleCount={activeVehicleCount}
        offlineVehicleCount={offlineVehicleCount}
        query={query}
        setQuery={setQuery}
        exportReport={exportReport}
      />
      <section className="fleet-layout">
        <aside className="vehicle-list">
          {filteredVehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} selected={selectedId === vehicle.id} vehicle={vehicle} onClick={() => setSelectedId(vehicle.id)} />
          ))}
        </aside>
        <div className="map-column">
          <FleetMap vehicles={filteredVehicles} selectedId={selectedId} setSelectedId={setSelectedId} mapConfig={mapConfig} parkings={parkings} />
          <VehicleDetail vehicle={selected} parkings={parkings} />
        </div>
      </section>
    </>
  );
}

function Toolbar({ statusFilter, setStatusFilter, vehicleStatusFilter, setVehicleStatusFilter, vehicleStatusOptions, modelFilter, setModelFilter, modelOptions, activeVehicleCount, offlineVehicleCount, query, setQuery, exportReport }) {
  const scopedStatusOptions = vehicleStatusOptions.filter((status) => (
    statusFilter === 'Offline' ? status === 'Offline' : status !== 'Offline'
  ));
  return (
    <section className="toolbar">
      <div className="status-toggle">
        <button className={statusFilter === 'Active' ? 'pill active' : 'pill'} onClick={() => { setStatusFilter('Active'); setVehicleStatusFilter('All statuses'); }} type="button">
          Active <span>{activeVehicleCount}</span>
        </button>
        <button className={statusFilter === 'Offline' ? 'pill active' : 'pill'} onClick={() => { setStatusFilter('Offline'); setVehicleStatusFilter('All statuses'); }} type="button">
          Offline <span>{offlineVehicleCount}</span>
        </button>
      </div>
      <label className="search-box">
        <Search size={20} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." />
      </label>
      <div className="filter-controls">
        <label className="filter-select">
          <span>Status</span>
          <select value={vehicleStatusFilter} onChange={(event) => setVehicleStatusFilter(event.target.value)}>
            <option>All statuses</option>
            {scopedStatusOptions.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="filter-select">
          <span>Model</span>
          <select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}>
            <option>All models</option>
            {modelOptions.map((model) => <option key={model}>{model}</option>)}
          </select>
        </label>
      </div>
      <button className="export-button" type="button" onClick={exportReport}>
        <Download size={18} /> Export All
      </button>
    </section>
  );
}

function VehicleCard({ vehicle, selected, onClick }) {
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
      <div className="battery-line">
        <div>
          <span>Battery</span>
          <strong>{formatPercent(vehicle.battery)}</strong>
        </div>
        <div className="progress"><span style={{ width: `${clampNumber(vehicle.battery, 0, 100)}%` }} /></div>
      </div>
      <div className="bottom-grid">
        <Info label="Today" value={`${formatNumber(vehicle.todayDistance)} km`} strong />
        <Info label="Running time" value={safeValue(vehicle.runningTime)} />
        <Info label="Odometer" value={formatOdometer(vehicle.odometer)} />
      </div>
      <div className="insight-grid">
        <Info label="CO2e saved vs CNG" value={safeValue(vehicle.carbon)} strong />
        <Info label="Average speed" value={safeValue(vehicle.avgSpeed)} />
        <Info label="Energy today" value={safeValue(vehicle.energy)} />
        <Info label="Battery temp" value={safeValue(vehicle.temp)} />
      </div>
      <Info label="Last update" value={safeValue(vehicle.lastUpdated)} />
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

function FleetMap({ vehicles, selectedId, setSelectedId, mapConfig, parkings = [] }) {
  const [activeMarkerId, setActiveMarkerId] = useState('');
  const mapMarkers = buildMapMarkers(vehicles, selectedId, parkings);
  const activeMarker = mapMarkers.find((marker) => marker.id === activeMarkerId);

  if (mapConfig?.enabled) {
    return <RealGoogleMap apiKey={mapConfig.apiKey} mapId={mapConfig.mapId} vehicles={vehicles} selectedId={selectedId} setSelectedId={setSelectedId} parkings={parkings} />;
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
          return (
            <button
              aria-label={marker.title}
              className={marker.selected ? `map-dot ${marker.kind} active` : `map-dot ${marker.kind}`}
              key={marker.id}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              type="button"
              onClick={() => {
                if (marker.vehicleId) setSelectedId(marker.vehicleId);
                setActiveMarkerId(marker.id);
              }}
              title={marker.title}
            />
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

function RealGoogleMap({ apiKey, mapId, vehicles, selectedId, setSelectedId, parkings = [] }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapError, setMapError] = useState('');
  const [activeMarkerId, setActiveMarkerId] = useState('');
  const mapMarkers = useMemo(() => buildMapMarkers(vehicles, selectedId, parkings), [vehicles, selectedId, parkings]);
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
      markersRef.current.forEach((marker) => {
        if ('map' in marker) marker.map = null;
        else marker.setMap(null);
      });
      const renderedMarkers = mapMarkers
        .filter((marker) => marker.coords)
        .map((marker) => {
          const position = marker.coords;
          if (!markerLibrary?.AdvancedMarkerElement) {
            const gmMarker = new window.google.maps.Marker({
              map: mapRef.current,
              position,
              title: marker.title,
              icon: googleDotIcon(markerColor(marker), marker.selected),
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
  const markerNode = document.createElement('button');
  markerNode.className = marker.selected ? `google-marker-dot ${marker.kind} active` : `google-marker-dot ${marker.kind}`;
  markerNode.type = 'button';
  markerNode.title = marker.title;
  markerNode.setAttribute('aria-label', marker.title);
  return markerNode;
}

function googleDotIcon(fill, selected = false) {
  const size = selected ? 22 : 16;
  const radius = selected ? 8 : 6;
  const svg = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${radius + 2}" fill="rgba(15,23,42,0.18)"/><circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="${fill}" stroke="#ffffff" stroke-width="3"/></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size / 2),
  };
}

function buildMapMarkers(vehicles, selectedId, globalParkings = []) {
  const markers = [];
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
    addLocationMarker(markers, vehicle, 'hub', selected);
    addLocationMarker(markers, vehicle, 'parking', selected);
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
        ['Spaces left', p.spacesLeft ?? 'N/A'],
      ],
    });
  });
  return markers;
}

function addLocationMarker(markers, vehicle, kind, selected) {
  const coords = kind === 'hub' ? hubCoordsFor(vehicle) : parkingCoordsFor(vehicle);
  if (!coords) return;
  const name = kind === 'hub' ? safeValue(vehicle.hub, 'Mapped hub') : safeValue(vehicle.parking, 'Mapped parking');
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

function markerZIndex(marker) {
  if (marker.selected) return 40;
  if (marker.kind === 'vehicle') return 30;
  return 20;
}

function extractMapCoords(link) {
  const value = decodeURIComponent(String(link || ''));
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

function VehicleDetail({ vehicle, parkings = [] }) {
  const parkingRecord = (parkings || []).find((p) => p.name === vehicle.parking);
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
        <MetricMini icon={Gauge} label="Running time" value={safeValue(vehicle.runningTime)} />
        <MetricMini icon={Car} label="Odometer" value={formatOdometer(vehicle.odometer)} />
        <MetricMini icon={Zap} label="CO2e saved vs CNG" value={safeValue(vehicle.carbon)} />
      </div>
      <div className="detail-tabs">
        <div>
          <h3>Now</h3>
          <p>Current location: {safeValue(vehicle.location)}</p>
          <p>Last stop: {safeValue(vehicle.lastStop)}</p>
          <p>Assigned parking: {safeValue(vehicle.parking)}{parkingRecord?.spacesLeft !== undefined ? ` · ${parkingRecord.spacesLeft} spaces left` : ''}</p>
          <p>Average speed: {safeValue(vehicle.avgSpeed)}</p>
          <p>Last update: {safeValue(vehicle.lastUpdated)}</p>
        </div>
        <div>
          <h3>Driver</h3>
          <p>{vehicle.driverState === 'active' ? 'Currently driven by' : vehicle.driverState === 'assigned' ? 'Assigned driver today' : vehicle.driverState === 'last' ? 'Last driven by' : 'Driver status'}</p>
          <strong>{vehicle.driver}</strong>
          <p>{vehicle.driverMeta}</p>
        </div>
        <div>
          <h3>Assignment</h3>
          <p>Parking: {vehicle.parking}</p>
          <p>Place status: {vehicle.locationState || 'Not assigned to a hub/parking geofence'}</p>
          {vehicle.hubGmpLink && <p><a href={vehicle.hubGmpLink} target="_blank" rel="noreferrer">Open hub map link</a></p>}
          {vehicle.parkingGmpLink && <p><a href={vehicle.parkingGmpLink} target="_blank" rel="noreferrer">Open parking map link</a></p>}
          <p>Energy today: {safeValue(vehicle.energy)}</p>
          <p>Battery temperature: {safeValue(vehicle.temp)}</p>
          <p>Carbon basis: {safeValue(vehicle.confidence, 'Estimated vs CNG')}</p>
        </div>
      </div>
    </section>
  );
}

function ClientsHub({ addClient, refreshClientHubs, clientHubs, vehicles }) {
  const [viewingClient, setViewingClient] = useState(null);
  const [newHubName, setNewHubName] = useState('');
  const [newHubLink, setNewHubLink] = useState('');

  async function openClientHubs(client) {
    setViewingClient(client);
    // ensure fresh data
    if (refreshClientHubs) await refreshClientHubs();
  }

  async function addHubForClient(e) {
    e && e.preventDefault();
    if (!viewingClient || !newHubName) return;
    try {
      const response = await fetch('/api/client-hubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: viewingClient.client, gstNumber: viewingClient.gstNumber || '', clientPoc: viewingClient.clientPoc || '', hubs: `${newHubName} | ${newHubLink}`, parkings: '' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.message || 'Unable to add hub');
      setNewHubName(''); setNewHubLink('');
      if (refreshClientHubs) await refreshClientHubs();
      setViewingClient(payload.clients?.find((c) => c.client === viewingClient.client) || viewingClient);
    } catch (error) {
      // ignore for now
    }
  }

  return (
    <section className="table-panel">
      <div className="panel-title">
        <div>
          <h2>Clients</h2>
        </div>
      </div>
      {clientHubs.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>GST number</th>
                <th>Client POC</th>
                <th>Hubs</th>
                <th>Parking points</th>
                <th>Vehicles deployed</th>
              </tr>
            </thead>
            <tbody>
              {clientHubs.map((client) => {
                const hubs = normalizeLocationRecords(client.hubs);
                const parkings = normalizeLocationRecords(client.parkings);
                const deployedCount = vehicles.filter((vehicle) => normalizeClientName(vehicle.client) === normalizeClientName(client.client) && hasClientDeployment(vehicle)).length;
                return (
                  <tr key={client.client}>
                    <td>{client.client}</td>
                    <td>{safeValue(client.gstNumber, 'Not added')}</td>
                    <td>{safeValue(client.clientPoc, 'Not added')}</td>
                    <td><button className="ghost-action" type="button" onClick={() => openClientHubs(client)}>{hubs.length}</button></td>
                    <td>{parkings.length}</td>
                    <td>{deployedCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">No reusable clients added yet.</div>
      )}

      {viewingClient && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card">
            <div className="panel-title">
              <h3>Hubs for {viewingClient.client}</h3>
              <button className="ghost-action compact-action" type="button" onClick={() => setViewingClient(null)}>Close</button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <strong>Hubs</strong>
                <ul>
                  {normalizeLocationRecords(viewingClient.hubs).map((h) => <li key={h.name}><a href={h.gmpLink} target="_blank" rel="noreferrer">{h.name}</a></li>)}
                </ul>
              </div>
              <div>
                <strong>Parkings</strong>
                <ul>
                  {normalizeLocationRecords(viewingClient.parkings).map((p) => <li key={p.name}><a href={p.gmpLink} target="_blank" rel="noreferrer">{p.name}</a></li>)}
                </ul>
              </div>
              <form onSubmit={addHubForClient} className="inline-form">
                <label>New hub name<input value={newHubName} onChange={(e) => setNewHubName(e.target.value)} required /></label>
                <label>Google Maps link<input value={newHubLink} onChange={(e) => setNewHubLink(e.target.value)} placeholder="https://maps.google.com/..." /></label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="primary-action" type="submit">Add hub</button>
                  <button className="ghost-action" type="button" onClick={() => { setNewHubName(''); setNewHubLink(''); }}>Clear</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
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
  const globalParkings = Array.isArray(parkings) ? parkings.map((p) => ({ name: p.name, gmpLink: p.gmpLink || '', lat: p.lat, lng: p.lng, totalSpaces: p.totalSpaces, spacesLeft: p.spacesLeft })) : [];
  const combinedParkings = [...clientParkings, ...globalParkings];
  const selectedHubRecord = hubs.find((hub) => hub.name === selectedHub) || hubs[0];
  const selectedParkingRecord = combinedParkings.find((parking) => parking.name === selectedParking) || combinedParkings[0];
  const selectedLayoverParkingRecord = combinedParkings.find((parking) => parking.name === selectedLayoverParking) || selectedParkingRecord;
  const vehicleEligible = canScheduleVehicleForDeployment(selectedVehicle);
  const canDeploy = Boolean(vehicles.length && selectedVehicle && selectedClient && hubs.length && parkings.length);
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
        <label>Nearest parking<select name="parking" value={selectedParking} onChange={(event) => setSelectedParking(event.target.value)} required>{combinedParkings.map((parking) => <option key={parking.name} value={parking.name}>{parking.name}{parking.spacesLeft !== undefined ? ` (${parking.spacesLeft} left)` : ''}</option>)}</select></label>
        <input name="parkingGmpLink" type="hidden" value={selectedParkingRecord?.gmpLink || ''} />
        <input name="parkingLat" type="hidden" value={selectedParkingRecord?.lat || ''} />
        <input name="parkingLng" type="hidden" value={selectedParkingRecord?.lng || ''} />
        {endPrevious && <label>Undeploy previous site at<input name="previousUndeployAt" type="datetime-local" required /></label>}
        <label>Deploy at<input name="deployAt" type="datetime-local" required /></label>
        <label>Layover parking<select name="layoverParking" value={selectedLayoverParking} onChange={(event) => setSelectedLayoverParking(event.target.value)} required>{combinedParkings.map((parking) => <option key={parking.name} value={parking.name}>{parking.name}{parking.spacesLeft !== undefined ? ` (${parking.spacesLeft} left)` : ''}</option>)}</select></label>
        <input name="layoverParkingGmpLink" type="hidden" value={selectedLayoverParkingRecord?.gmpLink || ''} />
        <input name="layoverParkingLat" type="hidden" value={selectedLayoverParkingRecord?.lat || ''} />
        <input name="layoverParkingLng" type="hidden" value={selectedLayoverParkingRecord?.lng || ''} />
        <label>How this vehicle will be used<select name="usage"><option>Shipment support</option><option>Dedicated hub movement</option><option>Inter-hub movement</option><option>Hybrid use</option></select></label>
        <label>Project/Ops POC<input name="poc" placeholder="Responsible POC" required /></label>
        {!canDeploy && <span className="form-note">Add a client with mapped hubs and parking, then choose a vehicle and set deploy time.</span>}
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
            const parkingList = normalizeLocationRecords(item.parkings);
            return (
              <article key={item.client}>
                <strong>{item.client}</strong>
                <span>GST: {safeValue(item.gstNumber, 'Not added')} | POC: {safeValue(item.clientPoc, 'Not added')}</span>
                <span>{clientHubsList.length} hubs | {parkingList.length} parking points</span>
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
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-card client-hub-form" onSubmit={addClient}>
        <div className="panel-title">
          <h2>Add Client</h2>
          <button className="ghost-action compact-action" type="button" onClick={closeModal}>Close</button>
        </div>
        <label>GST number<input name="gstNumber" placeholder="Client GST number" required /></label>
        <label>Client name<input name="client" placeholder="Client name" required /></label>
        <label>Client POC<input name="clientPoc" placeholder="Name, phone or email" required /></label>
        <label>Hubs + Google Maps links<textarea name="hubs" placeholder="Hub name | https://maps.google.com/..." rows="4" required /></label>
        <label>Parking points + Google Maps links<textarea name="parkings" placeholder="Parking point | https://maps.google.com/..." rows="4" required /></label>
        <div className="modal-actions">
          <button className="ghost-action" type="button" onClick={closeModal}>Cancel</button>
          <button className="primary-action" type="submit"><Plus size={18} /> Add Client</button>
        </div>
      </form>
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

function ParkingManager({ parkings, addParking, updateParkingSpaces }) {
  const [name, setName] = useState('');
  const [spaces, setSpaces] = useState(10);
  const [gmpLink, setGmpLink] = useState('');

  function handleAdd(event) {
    event.preventDefault();
    if (!name) return;
    addParking({ name: name.trim(), totalSpaces: Number(spaces) || 0, gmpLink: gmpLink.trim() });
    setName(''); setSpaces(10); setGmpLink('');
  }

  return (
    <section className="table-panel">
      <div className="panel-title">
        <h2>Parking sites</h2>
        <span>{parkings.length} parking site(s)</span>
      </div>
      <form className="inline-form" onSubmit={handleAdd}>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Parking name" required /></label>
        <label>Spaces<input value={spaces} onChange={(e) => setSpaces(e.target.value)} type="number" min="0" /></label>
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
            <div className="task-actions">
              <label>Spaces<input defaultValue={p.totalSpaces} type="number" onBlur={(e) => updateParkingSpaces(p.name, Number(e.target.value) || 0)} /></label>
              <small>{p.spacesLeft ?? 'N/A'} left</small>
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
        rows={vehicles.map((vehicle) => [vehicle.id, vehicle.client, vehicle.hub, vehicle.driver, `${vehicle.todayDistance} km`, vehicle.runningTime, `${vehicle.battery}%`, vehicle.carbon, vehicle.confidence])}
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
      const response = await fetch('/api/alerts/preview');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || 'Unable to load alerts');
      if (payload.setupNeeded) throw new Error(payload.message || payload.error || 'Alert setup needed');
      setState({ loading: false, alerts: payload.alerts || [], recipients: payload.recipients || [], thresholds: payload.thresholds, previousDate: payload.previousDate, error: '' });
    } catch (error) {
      setState({ loading: false, alerts: [], recipients: [], thresholds: null, error: error.message });
    }
  }

  async function sendAlerts() {
    setSending(true);
    try {
      const response = await fetch('/api/alerts/send', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || payload.message || 'Unable to send alerts');
      setState((current) => ({ ...current, sentMessage: `Sent to ${payload.sent} recipient(s) for ${payload.vehicles || 0} vehicle(s). Delivery: ${payload.delivery?.mode || 'none'}` }));
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
          <p>Vehicles are flagged when previous-day distance is low or running time is below 60 minutes.</p>
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
        columns={['Vehicle', 'Status', 'Distance', 'Running time', 'Battery', 'Reason', 'Last updated']}
        rows={state.alerts.map((alert) => [alert.vehicle, alert.status, `${alert.distanceTodayKm} km`, `${alert.runningMinutes} min`, `${alert.batteryPercent}%`, alert.reasons.join('; '), alert.lastUpdated])}
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
          <span>Vehicles above {settingsState.goodCharge}% charge and below {settingsState.minDistance} km movement are eligible for unused-vehicle alerts.</span>
          <span>Running time below {settingsState.minRunTime} minutes is treated as no meaningful movement.</span>
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

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
  return payload;
}

async function loadProductionVehicles() {
  const apiUrl = import.meta.env.VITE_FLEET_DATA_API_URL || '/api/fleet';
  const csvUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL;

  if (apiUrl) {
    const response = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload.vehicles;
    if ((rows || []).every((row) => row.id && row.lat !== undefined && row.lng !== undefined)) return rows;
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
    const get = (...keys) => {
      for (const key of keys) {
        const value = row[key] ?? row[toSnake(key)] ?? row[toTitle(key)] ?? row[key.toLowerCase()];
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
      }
      return '';
    };
    const vehicleNumber = String(get('id', 'vehicle_number', 'Vehicle number', 'Vehicle No', 'vehicle', 'registration')).trim();
    const lat = Number(get('latitude', 'lat', 'Current location latitude'));
    const lng = Number(get('longitude', 'lng', 'lon', 'Current location longitude'));
    return {
      id: vehicleNumber || `EV-${index + 1}`,
      model: get('model', 'vehicle_model', 'Vehicle model', 'Make model') || '',
      sourceSystem: get('source_system', 'Source system') || '',
      client: get('client', 'Client') || 'Unassigned client',
      hub: get('hub', 'Client hub', 'Hub') || 'Unassigned hub',
      parking: get('parking', 'Parking location') || 'Parking unavailable',
      status: normalizeStatus(get('status', 'Live status', 'Current status')),
      battery: Number(get('battery', 'battery_percent', 'Current battery charge', 'soc')) || 0,
      distance: Number(get('distance_left', 'Distance left')) || 0,
      todayDistance: Number(get('distance_today', 'Distance covered today', 'Distance covered')) || 0,
      runningTime: get('running_time', 'Running time today') || 'Unavailable',
      avgSpeed: get('average_speed', 'Average speed today') || 'Unavailable',
      temp: get('temperature', 'Temperature') || 'Unavailable',
      odometer: get('odometer', 'Odometer') || 'Unavailable',
      energy: get('energy', 'Energy consumed today') || 'Unavailable',
      eta: get('eta', 'Estimated Time of Arrival') || 'Unavailable',
      etaDate: get('eta_date', 'ETA date') || '06-05-2026',
      lastUpdated: get('last_updated', 'Last updated', 'Vehicle updated timestamp') || 'Unavailable',
      driverState: get('driver_state') || 'none',
      driver: get('driver', 'Active driver', 'Assigned driver', 'Last driver') || 'No driver confirmed yet',
      driverMeta: get('driver_meta') || 'Loaded from production source',
      route: get('route', 'Route') || 'Route unavailable',
      location: get('location', 'Current location text') || 'Location unavailable',
      lastStop: get('last_stop', 'Last stop text address') || 'Last stop unavailable',
      carbon: get('carbon', 'Carbon saved vs CNG') || 'Unavailable',
      confidence: get('carbon_confidence', 'Carbon confidence') || 'Unavailable',
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
      const [name = '', ...linkParts] = line.trim().split('|');
      return { name: name.trim(), gmpLink: linkParts.join('|').trim() };
    })
    .filter((item) => item.name || item.gmpLink);
}

function parseCarbonKg(value) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
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
