-- Production performance layer for EV Dashboard
-- Keeps the live dashboard fast by reading current vehicle state from `vehicles`
-- while retaining append-only telemetry in `vehicle_snapshots`.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS source_system text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS client text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

ALTER TABLE ops_tasks ADD COLUMN IF NOT EXISTS task_id text UNIQUE;
ALTER TABLE ops_tasks ADD COLUMN IF NOT EXISTS completed_by text;
ALTER TABLE ops_tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE TABLE IF NOT EXISTS vehicle_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scraped_at timestamptz NOT NULL DEFAULT now(),
  source text,
  vehicle_id text,
  vehicle_number text,
  vehicle_model text,
  latitude double precision,
  longitude double precision,
  distance_today_km numeric,
  odometer_km numeric,
  today_running_minutes numeric,
  today_avg_speed_kmph numeric,
  movement_status_raw text,
  battery_percent numeric,
  state_of_health numeric,
  energy_today_kwh numeric,
  last_stop_location_text text,
  raw_payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_client ON vehicles (client);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles (status);
CREATE INDEX IF NOT EXISTS idx_vehicles_last_updated ON vehicles (last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_vehicles_source_system ON vehicles (source_system);

CREATE INDEX IF NOT EXISTS idx_vehicle_snapshots_vehicle_time ON vehicle_snapshots (vehicle_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_snapshots_time ON vehicle_snapshots (scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_snapshots_source_time ON vehicle_snapshots (source, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_deployments_vehicle_status_created ON deployments (vehicle, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_client_created ON deployments (client, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_vehicle_created ON driver_assignments (vehicle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_email_date ON driver_assignments (email, shift_date DESC);
CREATE INDEX IF NOT EXISTS idx_ops_tasks_status_created ON ops_tasks (status, created_at DESC);
