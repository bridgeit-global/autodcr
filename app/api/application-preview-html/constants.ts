/**
 * Placeholder for HTML templates (bucket `Application_Templates` or local `draft/html`).
 * Server replaces this in place with a QR encoding the saved PDF URL from
 * `projects.application_urls` (usually `application_urls[templateType]`; Architect
 * acceptance uses `Architect_acceptance`).
 *
 * Convention for every new application (building permission, lift, garden, etc.):
 * put `$project_Saved_Pdf_QR` or `{{SAVED_PDF_QR}}` where the QR should appear
 * (recommended: a `.qr-cell` / `.saved-pdf-qr-stack` in the letter header).
 * Catalog `show_qrcode` enables/disables injection — no new TypeScript per app.
 */
export const PROJECT_SAVED_PDF_QR_SENTINEL = "$project_Saved_Pdf_QR";
export const CATALOG_SAVED_PDF_QR_SENTINEL = "{{SAVED_PDF_QR}}";
