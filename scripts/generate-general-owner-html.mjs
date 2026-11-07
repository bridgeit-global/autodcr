/**
 * Generate owner annexure HTML under html/General/owner/.
 * Plinth + Development Completion also get Architect-pack copies under
 * html/General/consultants/architect/ (signer + letterhead follow each pack).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "..", "html", "General", "owner");
const ARCH_OUT = path.resolve(
  import.meta.dirname,
  "..",
  "html",
  "General",
  "consultants",
  "architect"
);

const CSS = `
@page { size:A4; margin:17mm; }
*{box-sizing:border-box}
/* Match pipeline densify: equal 10.5pt, tight lh, near-zero vertical air — every letterheaded form. */
body{margin:0;background:#fff;color:#111;font-family:"Times New Roman",Times,serif;font-size:10.5pt;line-height:1.06}
.page{width:210mm;min-height:0;margin:14px auto;background:#fff;padding:17mm}
.form-title{text-align:center;font-weight:bold;text-decoration:underline;font-size:11.5pt;margin:0 0 1px;line-height:1.05}
.form-subtitle{text-align:center;font-size:10.5pt;margin:0 0 2px;line-height:1.05}
.annexure{text-align:center;font-weight:bold;margin:0;line-height:1.05;font-size:10.5pt}
.note{text-align:center;font-style:italic;margin:0 0 2px;font-size:10.5pt}
.center{text-align:center}.right{text-align:right}.bold{font-weight:bold}.underline{text-decoration:underline}
.value-bold{font-weight:bold}
.cc-label{font-weight:normal}
.to-block{margin:0 0 1px}
.to-block .to-label{margin:0;padding:0;line-height:1.05}
.to-block .to-content{margin-left:0.4in}
.to-block .to-content p{margin:0;padding:0;line-height:1.05;font-weight:bold}
p{margin:0;line-height:1.06}
.body-indent{text-indent:0.5in}
.meta-table{border-collapse:collapse;width:100%;margin:0 0 1px}
.meta-table td{padding:0;vertical-align:top;line-height:1.05;font-size:10.5pt;word-break:break-word;overflow-wrap:anywhere}
.meta-table .lbl{width:1%;white-space:nowrap;padding-right:6px;font-weight:normal;font-size:10.5pt}
/* No break-inside/before:avoid — Paged.js drops annexure body under letterhead margins. */
.closing{margin-top:0}
.closing>p{margin:0;line-height:1.05}
.sig{margin-top:0}
.sig>p{margin:0;line-height:1.05}
.sig .signer-role{margin:0;font-weight:bold;line-height:1.05}
.sig .architect-block .meta-line,.sig .consultant-block .meta-line{margin:0;line-height:1.05}
.sig .meta-label{font-weight:normal}
.cc{margin-top:0}
.cc p{margin:0;line-height:1.05}
.dsc-stamp-slot{width:180px;height:60px;margin:2px 0}
.dsc-stamp-slot--owner,.dsc-stamp-slot--consultant{margin-top:2px;margin-bottom:2px}
.stamp-note{text-align:center;font-weight:bold;margin:0 0 4px;text-transform:uppercase;font-size:10.5pt}
.field-row{margin:0;line-height:1.15}
.field-row .lbl{font-weight:normal}
.addr-cont{margin:0 0 0 1.6in;line-height:1.15}
.person-photo-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:2px 0}
.person-photo-row .person-fields{flex:1;min-width:0}
.photo-box{width:28mm;height:35mm;border:1px solid #111;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9pt;color:#666}
@media print{body{background:#fff}.page{width:auto;min-height:auto;margin:0;padding:0}}
`.trim();

const vb = (t) => `<span class="value-bold">${t}</span>`;

function dscSlot(role = "consultant") {
  const cls =
    role === "owner"
      ? "dsc-stamp-slot dsc-stamp-slot--owner"
      : role === "consultant"
        ? "dsc-stamp-slot dsc-stamp-slot--consultant"
        : "dsc-stamp-slot";
  return `<div class="${cls}" aria-hidden="true"></div>`;
}

function architectSignerBlock({ includeDate = true } = {}) {
  return `<div class="architect-block">
<p class="signer-role">${vb("{{ARCHITECT_OR_LS_ROLE}}")}</p>
<p class="meta-line"><span class="meta-label">Name:</span> ${vb("{{ARCHITECT_LS_NAME}}")}</p>
<p class="meta-line"><span class="meta-label">{{ARCHITECT_OR_LS_REG_LABEL}}:</span> ${vb("{{ARCHITECT_LS_REG_NO}}")}</p>
<p class="meta-line"><span class="meta-label">Valid upto:</span> ${vb("{{ARCHITECT_LS_VALIDITY}}")}</p>
${includeDate ? `<p>Date: ${vb("{{LETTER_DATE}}")}</p>` : ""}
</div>`;
}

/** Owner-pack closing (Notice-style Name / Address). */
function ownerSignerBlock({ includeDate = true } = {}) {
  return `${dscSlot("owner")}
<p>Name of the ${vb("{{OWNER_OR_DEVELOPER}}")}: ${vb("{{OWNER_NAME}}")}</p>
<p>Address of ${vb("{{OWNER_OR_DEVELOPER}}")}: ${vb("{{OWNER_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_3}}")}</p>
${includeDate ? `<p>Date: ${vb("{{LETTER_DATE}}")}</p>` : ""}`;
}

function architectClosingSig({ includeDate = true } = {}) {
  return `<p>For ${vb("{{CONSULTANT_FIRM}}")},</p>
${dscSlot("consultant")}
${architectSignerBlock({ includeDate })}`;
}

function closing(sigInner, { cc = "", yours = "Yours Faithfully,", thanking = true } = {}) {
  return `<div class="closing">
${thanking ? `<p>Thanking you,</p>` : ""}
<p>${yours}</p>
<div class="sig">
${sigInner}
</div>
${cc}
</div>`;
}

function bpToBlock() {
  return `<div class="to-block">
<p class="to-label">To,</p>
<div class="to-content">
<p>The Executive Engineer (B.P.) - ${vb("{{WARD}}")} Ward,</p>
<p>O/o The Dy.Ch.Eng.(B.P.) ${vb("{{SUBURB}}")},</p>
<p>Brihanmumbai Municipal Corporation,</p>
<p>${vb("{{BP_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{BP_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{BP_ADDRESS_LINE_3}}")}</p>
</div>
</div>`;
}

function plotLine() {
  return vb("{{PLOT_CS_CTS_NO}}");
}

function divisionLine() {
  return vb("{{VILLAGE_DIVISION}}");
}

function wrap(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
${CSS}
</style>
</head>
<body>
<main class="page">
${body}
</main>
</body>
</html>
`;
}

function plinthBody(sigInner) {
  return `
<div class="annexure">ANNEXURE 14</div>
<div class="form-subtitle">[Regulations No.11(4)]</div>
<div class="form-title">Form of intimation of Completion of Work upto Plinth Level</div>
${bpToBlock()}
<p>Sir,</p>
<p class="body-indent">The construction upto plinth/column upto plinth level has been completed in Building No. ${vb("{{BUILDING_NO}}")} on/in ${plotLine()} ${divisionLine()} Road/Street ${vb("{{PROPERTY_ADDRESS}}")} Ward ${vb("{{WARD}}")} in accordance with your permission No. ${vb("{{FILE_NO}}")} dated ${vb("{{LAST_APPROVAL_NO}}")} under my supervision and in accordance with the sanctioned plan.</p>
<p class="body-indent">Please check the completed work and permit me to proceed with the rest of the work.</p>
${closing(sigInner)}
`;
}

function dccBody(sigInner) {
  return `
<div class="annexure">ANNEXURE 14</div>
<div class="form-subtitle">(Regulations No.11(6)&amp; (7))</div>
<div class="form-title">Form for Development completion certificate</div>
${bpToBlock()}
<p>Sir,</p>
<p class="body-indent">I certify that the erection/re-erection or part/full development work in/on building/ part building No. ${vb("{{BUILDING_NO}}")} on/in ${plotLine()} ${divisionLine()} situated at ${vb("{{PROPERTY_ADDRESS}}")} Ward ${vb("{{WARD}}")} has been supervised by me and has been completed on according to the plans sanctioned (office communication No. ${vb("{{FILE_NO}}")} dated ${vb("{{LAST_APPROVAL_NO}}")}).</p>
<p class="body-indent">The work has been completed to my best satisfaction the workmanship and all the materials (type and grade) have been used strictly in accordance with general and detailed specifications. No provisions of the Act or Development Control Regulations or no requisitions made, conditions prescribed or orders issued thereunder have been transgressed in the course of the work. I am enclosing three copies of the completion plans, one of which is cloth mounted. The building is fit for occupancy for which it has been erected/re-erected or altered, constructed and enlarged.</p>
<p class="body-indent">I have to request you to arrange for the inspection and give permission for the occupation of the building.</p>
${closing(sigInner)}
`;
}

const files = {
  "plinth-completion.html": wrap(
    "Intimation of Completion of Work upto Plinth Level",
    plinthBody(ownerSignerBlock({ includeDate: false }))
  ),

  "development-completion-certificate.html": wrap(
    "Development completion certificate",
    dccBody(ownerSignerBlock())
  ),

  // Architect-pack copies (same body; Architect/L.S. closes)
  "__arch__/plinth-completion.html": wrap(
    "Intimation of Completion of Work upto Plinth Level",
    plinthBody(architectClosingSig({ includeDate: false }))
  ),

  "__arch__/development-completion-certificate.html": wrap(
    "Development completion certificate",
    dccBody(architectClosingSig())
  ),


  "owners-plot-area-affidavit.html": wrap(
    "Owner's Plot Area Affidavit",
    `
<div class="annexure">ANNEXURE 4</div>
<div class="form-title">Owner's Plot Area Affidavit</div>
${bpToBlock()}
<table class="subject-reference-table">
  <tr>
    <td class="sr-label">Subject:</td>
    <td class="sr-value"><span class="value-bold">Owner's Plot Area Affidavit.</span></td>
  </tr>
  <tr>
    <td class="sr-label">Project:</td>
    <td class="sr-value">Proposed redevelopment on plot bearing ${vb("{{PLOT_CS_CTS_NO}}")} of Village- ${vb("{{VILLAGE}}")} at ${vb("{{PROPERTY_ADDRESS}}")} in ${vb("{{WARD}}")} Ward.</td>
  </tr>
  <tr>
    <td class="sr-label">Ref:</td>
    <td class="sr-value">${vb("{{PLANNING_AUTHORITY}}")} Proposal No. ${vb("{{FILE_NO}}")}</td>
  </tr>
</table>
<p class="body-indent">I/We, ${vb("{{SALUTATION}}")} ${vb("{{APPLICANT_NAME}}")}, ${vb("{{SIGNATORY_DESIGNATION}}")}, ${vb("{{OWNER_FIRM}}")} having its office at ${vb("{{COMMUNICATION_ADDRESS}}")} and possessing the rights of development by virtue Conveyance/ Lease/ Development Agreement/ Power of Attorney dated ${vb("{{DEVELOPMENT_RIGHTS_DATE}}")} for the property bearing Survey No. ${vb("{{S_NO}}")}, Hissa No. ${vb("{{H_NO}}")} &amp; ${plotLine()} of Village- ${vb("{{VILLAGE}}")} at ${vb("{{PROPERTY_ADDRESS}}")} in ${vb("{{WARD}}")} Ward, and having my residence/office at ${vb("{{OWNER_ADDRESS_LINE_1}}")}, do solemnly affirm and say as under:</p>
<p class="body-indent">I have submitted the plans through my Architect/Licensed Surveyor ${vb("{{ARCHITECT_LS_NAME}}")} having License No. ${vb("{{ARCHITECT_LS_REG_NO}}")} for development of the aforesaid property.</p>
<p class="body-indent">In order to verify the area, I have also carried out survey of the said plot through my Architect/ Licensed surveyor to ascertain the correctness of the area.</p>
<p class="body-indent">I say that my Architect/Licensed Surveyor has certified the said area on the basis of the property register card duly certified by the Superintendent of Land Records and/or on the basis survey carried out as per the boundaries of the property shown by me/us.</p>
<p class="body-indent">The said area works out to ${vb("{{PLOT_AREA}}")} Sq. M. (${vb("{{PLOT_AREA_WORDS}}")} Square Meters) and F.S.I is claimed for the plot area ${vb("{{PLOT_AREA}}")} Sq. M. (${vb("{{PLOT_AREA_WORDS}}")} Square Meters)</p>
<p class="body-indent">It may also be stated here that I/we do not hold /own any contiguous land with the subject land.</p>
<p>Solemnly affirmed at ${vb("{{CITY}}")}</p>
<p>Dated this ${vb("{{AFFIDAVIT_DAY}}")} Day of ${vb("{{AFFIDAVIT_MONTH}}")}, ${vb("{{AFFIDAVIT_YEAR}}")}</p>
<div class="sig">
${dscSlot("owner")}
<p>${vb("{{SALUTATION}}")} ${vb("{{APPLICANT_NAME}}")},</p>
<p>${vb("{{SIGNATORY_DESIGNATION}}")},</p>
<p>${vb("{{OWNER_FIRM}}")}</p>
<p class="bold">BEFORE ME.</p>
</div>
<p class="note">Note: To be submitted in original duly notarized</p>
`
  ),

  "personal-identification-information.html": wrap(
    "Personal Identification Information",
    `
<div class="form-title">PERSONAL IDENTIFICATION INFORMATION</div>
<p class="field-row"><span class="lbl">Name of Project:</span> ${vb("{{PROJECT_TITLE}}")}</p>
<p class="field-row"><span class="lbl">Name of Entity:</span> ${vb("{{OWNER_FIRM}}")}</p>
<p class="field-row"><span class="lbl">Address of Project:</span> ${vb("{{PLOT_CS_CTS_NO}}")} of ${vb("{{VILLAGE_DIVISION}}")}, ${vb("{{PROPERTY_ADDRESS}}")}, ${vb("{{WARD}}")} Ward.</p>
<p class="field-row"><span class="lbl">Permanent Account No.:</span> ${vb("{{ENTITY_PAN}}")}</p>
<div class="person-photo-row">
<div class="person-fields">
<p class="field-row"><span class="lbl">Name of Person:</span> ${vb("{{SALUTATION}}")} ${vb("{{APPLICANT_NAME}}")}</p>
</div>
<div class="photo-box" aria-label="Photo">Photo</div>
</div>
<p class="field-row"><span class="lbl">Residential Address:</span> ${vb("{{OWNER_ADDRESS_LINE_1}}")}</p>
<p class="addr-cont">${vb("{{OWNER_ADDRESS_LINE_2}}")}</p>
<p class="addr-cont">${vb("{{OWNER_ADDRESS_LINE_3}}")}</p>
<p class="field-row"><span class="lbl">Office Address:</span> ${vb("{{OWNER_FIRM}}")},</p>
<p class="addr-cont">${vb("{{COMMUNICATION_ADDRESS}}")}</p>
<p class="field-row"><span class="lbl">Mobile no.:</span> ${vb("{{MOBILE}}")}</p>
<p class="field-row"><span class="lbl">Email ID:</span> ${vb("{{EMAIL_ID}}")}</p>
<p class="field-row"><span class="lbl">Permanent Account No.:</span> ${vb("{{PAN}}")}</p>
<p class="field-row"><span class="lbl">AADHAR:</span> ${vb("{{AADHAR}}")}</p>
<p class="field-row"><span class="lbl">Date of Birth:</span> ${vb("{{DATE_OF_BIRTH}}")}</p>
<p class="field-row"><span class="lbl">Occupation:</span> ${vb("{{OCCUPATION}}")}</p>
<p class="field-row"><span class="lbl">Name, Seal and Sign:</span></p>
<div class="sig">
${dscSlot("owner")}
<p>${vb("{{SALUTATION}}")} ${vb("{{APPLICANT_NAME}}")}</p>
<p>${vb("{{OWNER_FIRM}}")}</p>
</div>
`
  ),
};

await mkdir(OUT, { recursive: true });
await mkdir(ARCH_OUT, { recursive: true });
for (const [name, html] of Object.entries(files)) {
  const isArch = name.startsWith("__arch__/");
  const destName = isArch ? name.slice("__arch__/".length) : name;
  const dest = path.join(isArch ? ARCH_OUT : OUT, destName);
  await writeFile(dest, html, "utf8");
  console.log("wrote", isArch ? path.join("consultants/architect", destName) : destName);
}
console.log("done", Object.keys(files).length, "files");
