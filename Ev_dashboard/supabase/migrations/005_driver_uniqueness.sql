-- Prevent duplicate driver onboarding.
-- Run after 003. Existing duplicate rows are collapsed first, keeping the newest row.
-- These expression indexes normalize common casing/formatting differences.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY regexp_replace(phone, '\D', '', 'g')
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS duplicate_rank
  FROM public.drivers
  WHERE regexp_replace(phone, '\D', '', 'g') <> ''
)
DELETE FROM public.drivers d
USING ranked r
WHERE d.id = r.id
  AND r.duplicate_rank > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(email)
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS duplicate_rank
  FROM public.drivers
  WHERE email IS NOT NULL AND btrim(email) <> ''
)
DELETE FROM public.drivers d
USING ranked r
WHERE d.id = r.id
  AND r.duplicate_rank > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(license_number)
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS duplicate_rank
  FROM public.drivers
  WHERE license_number IS NOT NULL AND btrim(license_number) <> ''
)
DELETE FROM public.drivers d
USING ranked r
WHERE d.id = r.id
  AND r.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_phone_digits_unique
ON public.drivers ((regexp_replace(phone, '\D', '', 'g')))
WHERE regexp_replace(phone, '\D', '', 'g') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_email_lower_unique
ON public.drivers ((lower(email)))
WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_license_lower_unique
ON public.drivers ((lower(license_number)))
WHERE license_number IS NOT NULL AND btrim(license_number) <> '';
