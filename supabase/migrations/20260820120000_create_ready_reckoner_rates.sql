-- Ready reckoner rates (expanded from dump.json via scripts/seed-ready-reckoner.mjs).
-- One row per english_village + survey_no for fast lookup on Government Fees page.

CREATE TABLE IF NOT EXISTS public.ready_reckoner_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  english_village text NOT NULL,
  marathi_village text NOT NULL,
  survey_no text NOT NULL,
  open_land numeric NOT NULL DEFAULT 0,
  residential numeric NOT NULL DEFAULT 0,
  office numeric NOT NULL DEFAULT 0,
  commercial numeric NOT NULL DEFAULT 0,
  industrial numeric NOT NULL DEFAULT 0,
  address text NOT NULL DEFAULT '',
  rate_unit text NOT NULL DEFAULT 'चौरस मीटर',
  district_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ready_reckoner_rates_village_survey_key UNIQUE (english_village, survey_no)
);

COMMENT ON TABLE public.ready_reckoner_rates IS
  'Mumbai suburban ready reckoner rates keyed by English village + survey/CTS number.';

CREATE INDEX IF NOT EXISTS ready_reckoner_rates_village_survey_idx
  ON public.ready_reckoner_rates (english_village, survey_no);

ALTER TABLE public.ready_reckoner_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ready_reckoner_rates_select_authenticated ON public.ready_reckoner_rates;
CREATE POLICY ready_reckoner_rates_select_authenticated ON public.ready_reckoner_rates
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.ready_reckoner_rates TO authenticated;
GRANT ALL ON public.ready_reckoner_rates TO service_role;
