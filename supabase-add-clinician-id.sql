-- Run this in the Supabase SQL Editor to add clinician_id to the patients table.
-- This links each patient to the clinician who created them.

ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS clinician_id uuid REFERENCES auth.users(id);

-- Optional: index for faster filtering when loading a clinician's patients
CREATE INDEX IF NOT EXISTS patients_clinician_id_idx ON public.patients (clinician_id);

-- Optional: allow null for existing rows; new rows should set clinician_id via the app.
COMMENT ON COLUMN public.patients.clinician_id IS 'Supabase auth user id of the clinician who created this patient';
