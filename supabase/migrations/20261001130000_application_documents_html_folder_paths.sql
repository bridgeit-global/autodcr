-- Point application_documents.html at folder-relative Storage keys
-- matching html/<folder>/<file> under Application_Templates.

UPDATE application_documents SET html = 'IOD/iod-cc-architect-letterhead.html'
WHERE html = 'iod-cc-architect-letterhead.html';

UPDATE application_documents SET html = 'IOD/report-iod-cc.html'
WHERE html = 'report-iod-cc.html';

UPDATE application_documents SET html = 'Further CC/application-further-cc.html'
WHERE html = 'application-further-cc.html';

UPDATE application_documents SET html = 'Further CC/report-further-cc.html'
WHERE html = 'report-further-cc.html';

UPDATE application_documents SET html = 'Part OC/application-part-oc-architect.html'
WHERE html = 'application-part-oc-architect.html';

UPDATE application_documents SET html = 'Part OC/indemnity-bond-part-oc.html'
WHERE html = 'indemnity-bond-part-oc.html';

UPDATE application_documents SET html = 'Full OC/application-full-oc-bcc.html'
WHERE html = 'application-full-oc-bcc.html';

UPDATE application_documents SET html = 'Full OC/report-documents-full-oc-bcc.html'
WHERE html = 'report-documents-full-oc-bcc.html';

UPDATE application_documents SET html = 'Full OC/report-compliance-iod-conditions-d-form.html'
WHERE html = 'report-compliance-iod-conditions-d-form.html';

UPDATE application_documents SET html = 'concession/data-sheet-scrutiny-concession.html'
WHERE html = 'data-sheet-scrutiny-concession.html';

UPDATE application_documents SET html = 'concession/fact-sheet.html'
WHERE html = 'fact-sheet.html';

UPDATE application_documents SET html = 'concession/list-indicative-concessions.html'
WHERE html = 'list-indicative-concessions.html';

UPDATE application_documents SET html = 'concession/proposal-full-potential.html'
WHERE html = 'proposal-full-potential.html';

UPDATE application_documents SET html = 'concession/report-various-concession-sought.html'
WHERE html = 'report-various-concession-sought.html';

UPDATE application_documents SET html = 'concession/scrutiny-sheet-iod-cc.html'
WHERE html = 'scrutiny-sheet-iod-cc.html';

UPDATE application_documents SET html = 'ending concession/iod-cc-pending-architect.html'
WHERE html = 'iod-cc-pending-architect.html';

UPDATE application_documents SET html = 'ending concession/iod-cc-pending-owner-undertaking.html'
WHERE html = 'iod-cc-pending-owner-undertaking.html';

UPDATE application_documents SET html = 'ending concession/work-start-notice.html'
WHERE html = 'work-start-notice.html';
