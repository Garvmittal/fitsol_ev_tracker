-- Client live-view deeplinks with email allowlists.
-- Run after 005. Shared tokens identify a portal, but an authenticated allowlisted
-- email is still required before live deployed-vehicle data is returned.

CREATE TABLE IF NOT EXISTS public.client_portals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id text UNIQUE NOT NULL,
  share_token text UNIQUE NOT NULL,
  label text NOT NULL,
  client text NOT NULL,
  allowed_emails text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_client_portals_client
ON public.client_portals ((lower(client)));

CREATE INDEX IF NOT EXISTS idx_client_portals_active
ON public.client_portals (active);

ALTER TABLE public.client_portals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.client_portals TO authenticated;

CREATE OR REPLACE FUNCTION public.client_portal_manager_is_active()
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
      AND (
        lower(coalesce(role, '')) IN ('admin', 'supervisor', 'ops')
        OR coalesce(permissions, '{}') && ARRAY['all', 'deployments']::text[]
      )
  );
$$;

REVOKE ALL ON FUNCTION public.client_portal_manager_is_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_manager_is_active() TO authenticated;

DROP POLICY IF EXISTS "portal admins manage client portals" ON public.client_portals;
CREATE POLICY "portal admins manage client portals"
ON public.client_portals
FOR ALL
TO authenticated
USING (public.client_portal_manager_is_active())
WITH CHECK (public.client_portal_manager_is_active());

CREATE OR REPLACE FUNCTION public.client_portal_access(
  p_share_token text,
  p_email text DEFAULT NULL
)
RETURNS TABLE (
  portal_id text,
  label text,
  client text,
  active boolean,
  allowed boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cp.portal_id,
    cp.label,
    cp.client,
    cp.active,
    cp.active
      AND coalesce(btrim(p_email), '') <> ''
      AND EXISTS (
        SELECT 1
        FROM unnest(cp.allowed_emails) AS allowed_email
        WHERE lower(btrim(allowed_email)) = lower(btrim(p_email))
      ) AS allowed
  FROM public.client_portals cp
  WHERE cp.share_token = p_share_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.client_portal_access(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_access(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.client_portal_user_has_access(p_client text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_portals cp
    WHERE cp.active = true
      AND (p_client IS NULL OR lower(btrim(cp.client)) = lower(btrim(p_client)))
      AND EXISTS (
        SELECT 1
        FROM unnest(cp.allowed_emails) AS allowed_email
        WHERE lower(btrim(allowed_email)) = lower(btrim(auth.email()))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.client_portal_user_has_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_user_has_access(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_portal_vehicle_access(p_vehicle text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.deployments d
    WHERE upper(btrim(d.vehicle)) = upper(btrim(p_vehicle))
      AND lower(coalesce(d.status, 'Active')) <> 'removed'
      AND public.client_portal_user_has_access(d.client)
  );
$$;

REVOKE ALL ON FUNCTION public.client_portal_vehicle_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_vehicle_access(text) TO authenticated;

DROP POLICY IF EXISTS "client portal members read deployed vehicles" ON public.vehicles;
CREATE POLICY "client portal members read deployed vehicles"
ON public.vehicles
FOR SELECT
TO authenticated
USING (public.client_portal_vehicle_access(id));

DROP POLICY IF EXISTS "client portal members read deployments" ON public.deployments;
CREATE POLICY "client portal members read deployments"
ON public.deployments
FOR SELECT
TO authenticated
USING (public.client_portal_user_has_access(client));

DROP POLICY IF EXISTS "client portal members read driver assignments" ON public.driver_assignments;
CREATE POLICY "client portal members read driver assignments"
ON public.driver_assignments
FOR SELECT
TO authenticated
USING (public.client_portal_user_has_access(client));

DROP POLICY IF EXISTS "client portal members read vehicle snapshots" ON public.vehicle_snapshots;
CREATE POLICY "client portal members read vehicle snapshots"
ON public.vehicle_snapshots
FOR SELECT
TO authenticated
USING (
  public.client_portal_vehicle_access(coalesce(vehicle_number, vehicle_id, ''))
);
