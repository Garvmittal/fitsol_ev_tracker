-- Supabase-only browser access policies for EV Dashboard.
-- Run after 001, 002, and 003 when the Vercel frontend talks directly to Supabase.

CREATE OR REPLACE FUNCTION public.portal_user_is_active()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE lower(email) = lower(auth.email())
      AND coalesce(active, true) = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.portal_user_is_active() TO authenticated;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parkings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portal users can read own profile" ON public.users;
CREATE POLICY "portal users can read own profile"
ON public.users
FOR SELECT
TO authenticated
USING (lower(email) = lower(auth.email()) AND coalesce(active, true) = true);

DROP POLICY IF EXISTS "portal authenticated access" ON public.vehicles;
CREATE POLICY "portal authenticated access" ON public.vehicles
FOR ALL TO authenticated
USING (public.portal_user_is_active())
WITH CHECK (public.portal_user_is_active());

DROP POLICY IF EXISTS "portal authenticated access" ON public.clients;
CREATE POLICY "portal authenticated access" ON public.clients
FOR ALL TO authenticated
USING (public.portal_user_is_active())
WITH CHECK (public.portal_user_is_active());

DROP POLICY IF EXISTS "portal authenticated access" ON public.hubs;
CREATE POLICY "portal authenticated access" ON public.hubs
FOR ALL TO authenticated
USING (public.portal_user_is_active())
WITH CHECK (public.portal_user_is_active());

DROP POLICY IF EXISTS "portal authenticated access" ON public.parkings;
CREATE POLICY "portal authenticated access" ON public.parkings
FOR ALL TO authenticated
USING (public.portal_user_is_active())
WITH CHECK (public.portal_user_is_active());

DROP POLICY IF EXISTS "portal authenticated access" ON public.deployments;
CREATE POLICY "portal authenticated access" ON public.deployments
FOR ALL TO authenticated
USING (public.portal_user_is_active())
WITH CHECK (public.portal_user_is_active());

DROP POLICY IF EXISTS "portal authenticated access" ON public.driver_assignments;
CREATE POLICY "portal authenticated access" ON public.driver_assignments
FOR ALL TO authenticated
USING (public.portal_user_is_active())
WITH CHECK (public.portal_user_is_active());

DROP POLICY IF EXISTS "portal authenticated access" ON public.ops_tasks;
CREATE POLICY "portal authenticated access" ON public.ops_tasks
FOR ALL TO authenticated
USING (public.portal_user_is_active())
WITH CHECK (public.portal_user_is_active());

DROP POLICY IF EXISTS "portal authenticated access" ON public.settings;
CREATE POLICY "portal authenticated access" ON public.settings
FOR ALL TO authenticated
USING (public.portal_user_is_active())
WITH CHECK (public.portal_user_is_active());

DROP POLICY IF EXISTS "portal authenticated access" ON public.vehicle_snapshots;
CREATE POLICY "portal authenticated access" ON public.vehicle_snapshots
FOR ALL TO authenticated
USING (public.portal_user_is_active())
WITH CHECK (public.portal_user_is_active());

DROP POLICY IF EXISTS "portal authenticated access" ON public.drivers;
CREATE POLICY "portal authenticated access" ON public.drivers
FOR ALL TO authenticated
USING (public.portal_user_is_active())
WITH CHECK (public.portal_user_is_active());

DROP POLICY IF EXISTS "portal authenticated access" ON public.parking_sites;
CREATE POLICY "portal authenticated access" ON public.parking_sites
FOR ALL TO authenticated
USING (public.portal_user_is_active())
WITH CHECK (public.portal_user_is_active());
