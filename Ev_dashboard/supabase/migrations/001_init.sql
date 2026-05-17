-- Supabase / Postgres initial schema for EV Dashboard
-- Run this against your Supabase Postgres database (psql or supabase db push)

-- Users table (simple; integrate with Supabase Auth if desired)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  permissions text[],
  created_at timestamptz DEFAULT now()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id text PRIMARY KEY,
  client text,
  hub text,
  parking text,
  status text,
  battery integer,
  distance numeric,
  today_distance numeric,
  running_time text,
  avg_speed text,
  temp text,
  odometer text,
  energy text,
  eta text,
  eta_date date,
  last_updated timestamptz,
  driver text,
  lat double precision,
  lng double precision,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Clients and hubs
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  gst_number text,
  poc text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  gmp_link text,
  lat double precision,
  lng double precision,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parkings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  gmp_link text,
  lat double precision,
  lng double precision,
  total_spaces integer DEFAULT 0,
  spaces_left integer DEFAULT 0,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Deployments
CREATE TABLE IF NOT EXISTS deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id text UNIQUE,
  vehicle text,
  client text,
  hub text,
  hub_gmp_link text,
  hub_lat double precision,
  hub_lng double precision,
  parking text,
  parking_gmp_link text,
  parking_lat double precision,
  parking_lng double precision,
  previous_undeploy_at text,
  deploy_at timestamptz,
  layover_parking text,
  layover_parking_gmp_link text,
  layover_parking_lat double precision,
  layover_parking_lng double precision,
  usage text,
  poc text,
  status text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  removed_by text,
  removed_at timestamptz,
  remove_reason text
);

-- Driver assignments
CREATE TABLE IF NOT EXISTS driver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id text UNIQUE,
  name text,
  email text,
  vehicle text,
  client text,
  hub text,
  shift_date date,
  shift text,
  status text,
  session_state text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- Ops tasks
CREATE TABLE IF NOT EXISTS ops_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  vehicle text,
  client text,
  hub text,
  parking text,
  poc text,
  due text,
  reason text,
  status text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text,
  updated_by text,
  updated_at timestamptz DEFAULT now()
);
