-- Add drivers + global parking sites (used by dashboard UI tabs)

CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id text UNIQUE,
  name text NOT NULL,
  phone text NOT NULL,
  license_number text NOT NULL,
  dob date NOT NULL,
  email text NOT NULL,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_drivers_email ON drivers (email);

CREATE TABLE IF NOT EXISTS parking_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_id text UNIQUE,
  name text NOT NULL,
  location text NOT NULL,
  gmp_link text NOT NULL,
  lat double precision,
  lng double precision,
  total_spaces integer DEFAULT 0,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_parking_sites_name ON parking_sites (name);

