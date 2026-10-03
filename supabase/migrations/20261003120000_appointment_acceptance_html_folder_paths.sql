-- Point appointment/acceptance catalog html at folder-relative Storage keys.

UPDATE application_documents SET html = 'Appointment/' || html
WHERE category = 'Appointment'
  AND html IS NOT NULL
  AND html NOT LIKE '%/%';

UPDATE application_documents SET html = 'Acceptance/' || html
WHERE category = 'Acceptance'
  AND html IS NOT NULL
  AND html NOT LIKE '%/%';
