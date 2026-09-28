-- {{TPS_NO}}: map to plot village / TPS schema. App only renders the
-- "Town Planning Scheme No. …" phrase when plotBelongsTo is F.P.No;
-- CS/CTS projects clear the token so nothing shows.
UPDATE public.placeholders
SET
  source_table = 'projects',
  source_column = 'save_plot_details->>villageName',
  label = 'T.P.S. / village (F.P. only)',
  updated_at = now()
WHERE id = 'tps_no';
