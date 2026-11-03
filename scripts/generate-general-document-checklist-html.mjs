/**
 * One-off generator: clean tokenized HTML for General / Document Checklist.
 * Output: html/General/document checklist/*.html
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(
  import.meta.dirname,
  "..",
  "html",
  "General",
  "document checklist"
);

const CSS = `
@page { size:A4; margin:17mm; }
*{box-sizing:border-box}
/* Dense rhythm so letterheaded annexures fit page 1 with DSC + long multi-CTS. */
body{margin:0;background:#fff;color:#111;font-family:"Times New Roman",Times,serif;font-size:10.5pt;line-height:1.14}
.page{width:210mm;min-height:0;margin:14px auto;background:#fff;padding:17mm}
.form-title{text-align:center;font-weight:bold;text-decoration:underline;font-size:11.5pt;margin:0 0 2px}
.form-subtitle{text-align:center;font-size:10pt;margin:0 0 6px}
.annexure{text-align:center;font-weight:bold;margin:0 0 1px;line-height:1.12}
.note{text-align:center;font-style:italic;margin:0 0 4px;font-size:10pt}
.center{text-align:center}.right{text-align:right}.bold{font-weight:bold}.underline{text-decoration:underline}
.value-bold{font-weight:bold}
.to-block{margin:1px 0 3px}
.to-block .to-label{margin:0;padding:0;line-height:1.12}
.to-block .to-content{margin-left:0.4in}
.to-block .to-content p{margin:0;padding:0;line-height:1.12;font-weight:bold}
p{margin:1px 0}
.meta-table{border-collapse:collapse;width:100%;margin:1px 0 3px}
.meta-table td{padding:0;vertical-align:top;line-height:1.08}
.meta-table td:last-child,.meta-table .value-bold{font-size:9pt;line-height:1.08;word-break:break-word;overflow-wrap:anywhere}
.meta-table .lbl{width:1%;white-space:nowrap;padding-right:6px;font-weight:normal;font-size:10pt}
/* No break-inside/before:avoid — Paged.js drops annexure body under letterhead margins. */
.closing{margin-top:1px}
.closing>p{margin:0;line-height:1.12}
.sig{margin-top:1px}
.sig>p{margin:0;line-height:1.12}
.sig .signer-role{margin:0;font-weight:bold;line-height:1.12}
.sig .architect-block .meta-line,.sig .consultant-block .meta-line{margin:0;line-height:1.08}
.sig .meta-label{font-weight:normal}
.cc{margin-top:2px}
.cc p{margin:0;line-height:1.12}
/* Same pocket as appointment signature-table dsc-stamp-slot (180×60); tighter air only. */
.dsc-stamp-slot{width:180px;height:60px;margin:4px 0}
.dsc-stamp-slot--owner{margin-top:4px;margin-bottom:4px}
.stamp-note{text-align:center;font-weight:bold;margin:0 0 10px;text-transform:uppercase;font-size:10.5pt}
@media print{body{background:#fff}.page{width:auto;min-height:auto;margin:0;padding:0}}
`.trim();

const vb = (t) => `<span class="value-bold">${t}</span>`;

/** Reserve DSC stamp space only where catalog `sign` requires it. */
function dscSlot(role = "consultant") {
  const cls =
    role === "owner"
      ? "dsc-stamp-slot dsc-stamp-slot--owner"
      : "dsc-stamp-slot";
  return `<div class="${cls}" aria-hidden="true"></div>`;
}

/**
 * Architect / L.S. closing — same labeled block as appointment acceptance
 * (role, Name, COA Reg. No., Valid upto). No salutation on the name line.
 */
function architectSignerBlock({ includeDate = true } = {}) {
  return `<div class="architect-block">
<p class="signer-role">Architect</p>
<p class="meta-line"><span class="meta-label">Name:</span> ${vb("{{ARCHITECT_LS_NAME}}")}</p>
<p class="meta-line"><span class="meta-label">COA Reg. No.:</span> ${vb("{{REG_NO}}")}</p>
<p class="meta-line"><span class="meta-label">Valid upto:</span> ${vb("{{VALIDITY}}")}</p>
${includeDate ? `<p>Date: ${vb("{{LETTER_DATE}}")}</p>` : ""}
</div>`;
}

/** Other consultant roles — Name / Reg. No. / Valid upto (acceptance-style). */
function consultantSignerBlock(roleLabel, nameToken, { includeDate = true } = {}) {
  return `<div class="consultant-block">
<p class="signer-role">${roleLabel}</p>
<p class="meta-line"><span class="meta-label">Name:</span> ${vb(nameToken)}</p>
<p class="meta-line"><span class="meta-label">Reg. No.:</span> ${vb("{{REG_NO}}")}</p>
<p class="meta-line"><span class="meta-label">Valid upto:</span> ${vb("{{VALIDITY}}")}</p>
${includeDate ? `<p>Date: ${vb("{{LETTER_DATE}}")}</p>` : ""}
</div>`;
}

/** Keep Thanking you / Yours Faithfully / signature (+ optional CC) on one page. */
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
  // Organisation is fixed on these BMC annexures (same as Word source) — not a token.
  // "To," alone on first line; address lines break below (Word annexure layout).
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

/**
 * Inline prose: label + number in one token (plotBelongsTo-aware).
 * Meta table rows: kind label in key, number-only in value — pipeline collapses
 * the slash lists via normalizePlotTypeLabelsInTemplateHtml.
 */
function plotLine() {
  return vb("{{PLOT_CS_CTS_NO}}");
}

function divisionLine() {
  return vb("{{VILLAGE_DIVISION}}");
}

function surveyMetaRow() {
  return `<tr><td class="lbl">Plot No./ C.S. No./ C.T.S. No. / F.P No.</td><td>${vb("{{PLOT_NO}}")} / ${vb("{{CS_NO}}")} / ${vb("{{CTS_NO}}")} / ${vb("{{FP_NO}}")}</td></tr>`;
}

function placeMetaRow() {
  return `<tr><td class="lbl">Division/ Village/ T.P. Scheme No.</td><td>${vb("{{DIVISION}}")} / ${vb("{{VILLAGE}}")} / ${vb("{{TPS_NO}}")}</td></tr>`;
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

const files = {
  "Plot Area Certificate.html": wrap(
    "Plot Area Certificate",
    `
<div class="annexure">ANNEXURE 3</div>
<div class="form-title">PLOT AREA CERTIFICATE</div>
${bpToBlock()}
<p>Subject:&nbsp;&nbsp;${vb("Acceptance of Supervision")}</p>
<p>Reference:&nbsp;&nbsp;Proposal File No. ${vb("{{FILE_NO}}")}</p>
<table class="meta-table">
<tr><td class="lbl">Full Particular of the work</td><td>${vb("{{PROJECT_TITLE}}")}</td></tr>
${surveyMetaRow()}
${placeMetaRow()}
<tr><td class="lbl">Type of Development</td><td>${vb("{{TYPE_OF_DEVELOPMENT}}")}</td></tr>
<tr><td class="lbl">Road Name</td><td>${vb("{{PROPERTY_ADDRESS}}")}</td></tr>
<tr><td class="lbl">Ward</td><td>${vb("{{WARD}}")}</td></tr>
</table>
<p>I have submitted a proposal on behalf of my/our client Shri/M/s. ${vb("{{CLIENT_NAME}}")} for the proposed development on the above referred plot.</p>
<p>The area of the plot is ${vb("{{PLOT_AREA}}")} sq. m as per the P.R. Cards obtained from city Survey office dated ${vb("{{DATE_OF_PRC}}")}.</p>
<p>In order to verify the plot area, I/We have carried out the survey of the said plot through our staff to ascertain correctness of the area mentioned in the Property Register Card. The said survey has been carried out on the basis of the boundaries of the plot shown by the Owner/Client.</p>
<p>The said area as per the survey now works out to ${vb("{{PLOT_AREA}}")} sq. m. and F.S.I. is claimed for the plot area ${vb("{{PLOT_AREA}}")} sq. m.</p>
${closing(`<p>For ${vb("{{CONSULTANT_FIRM}}")},</p>
${dscSlot("consultant")}
${architectSignerBlock()}`)}
`
  ),

  "Supervision Memo Of Architect.html": wrap(
    "Supervision Memo Of Architect",
    `
<div class="annexure">ANNEXURE 2</div>
<div class="form-title">FORM OF SUPERVISION ACCEPTANCE</div>
${bpToBlock()}
<p>Subject:&nbsp;&nbsp;${vb("Acceptance of Supervision")}</p>
<p>Reference:&nbsp;&nbsp;Proposal File No. ${vb("{{FILE_NO}}")}</p>
<p>Dear Sir,</p>
<p>The development work of the</p>
<table class="meta-table">
<tr><td class="lbl">Full Particular of the work</td><td>${vb("{{PROJECT_TITLE}}")}</td></tr>
${surveyMetaRow()}
${placeMetaRow()}
<tr><td class="lbl">Type of Development</td><td>${vb("{{TYPE_OF_DEVELOPMENT}}")}</td></tr>
<tr><td class="lbl">Road Name</td><td>${vb("{{PROPERTY_ADDRESS}}")}</td></tr>
<tr><td class="lbl">Ward</td><td>${vb("{{WARD}}")}</td></tr>
</table>
<p>will be carried out under my supervision. All the materials (type and grade) and the workmanship of the work will generally tally with the general specifications submitted along with the plans and the work will be carried out according to the sanctioned plans. I shall be responsible for the execution of the work in all respects.</p>
<p>This is for your information &amp; record please.</p>
${closing(
  `<p>For ${vb("{{CONSULTANT_FIRM}}")},</p>
${dscSlot("consultant")}
${architectSignerBlock()}`,
  {
    cc: `<div class="cc">
<p><span class="bold">C.C. to:</span>&nbsp;&nbsp;${vb("{{OWNER_OR_DEVELOPER}}")}</p>
<p>${vb("{{APPLICANT_NAME}}")},</p>
<p>${vb("{{OWNER_FIRM}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_3}}")}</p>
</div>`,
  }
)}
`
  ),

  "Supervision Memo Of Structural Engineer.html": wrap(
    "Supervision Memo Of Structural Engineer",
    `
<div class="annexure">ANNEXURE–5</div>
<div class="form-title">SUPERVISION MEMO OF STRUCTURAL ENGINEER</div>
${bpToBlock()}
<p>Subject:&nbsp;&nbsp;${vb("Acceptance of Supervision")}</p>
<p>Reference:&nbsp;&nbsp;Proposal File No. ${vb("{{FILE_NO}}")}</p>
<table class="meta-table">
<tr><td class="lbl">Full Particular of the work</td><td>${vb("{{PROJECT_TITLE}}")}</td></tr>
${surveyMetaRow()}
${placeMetaRow()}
<tr><td class="lbl">Type of Development</td><td>${vb("{{TYPE_OF_DEVELOPMENT}}")}</td></tr>
<tr><td class="lbl">Road Name</td><td>${vb("{{PROPERTY_ADDRESS}}")}</td></tr>
<tr><td class="lbl">Ward</td><td>${vb("{{WARD}}")}</td></tr>
</table>
<p>With reference to the letter of our appointment dated ${vb("{{APPOINTMENT_DATE}}")} addressed to you, by the ${vb("{{OWNER_OR_DEVELOPER}}")}, I hereby confirm that I have agreed to act as the Consulting Structural Engineer for the above proposal.</p>
<p>I further confirm that the structural design and calculations shall be in conformity with the provisions of I.S. Code nos. 1875, 1893 &amp; 4326 taking into consideration the Seismic Forces etc. as required by the planning authority.</p>
<p>This is for your information &amp; record please.</p>
${closing(
  `<p>For ${vb("{{CONSULTANT_FIRM}}")},</p>
${dscSlot("consultant")}
${consultantSignerBlock("Structural Engineer", "{{STRUCTURAL_ENGINEER}}")}`,
  {
    cc: `<div class="cc">
<p><span class="bold">C.C. to:</span></p>
<p>1. ${vb("{{OWNER_OR_DEVELOPER}}")}</p>
<p>${vb("{{APPLICANT_NAME}}")},</p>
<p>${vb("{{OWNER_FIRM}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_3}}")}</p>
<p>2. Architect/ Licensed Surveyor</p>
<p>${vb("{{ARCHITECT_LS_NAME}}")}</p>
<p>${vb("{{ARCHITECT_LS_OFFICE}}")}</p>
<p>${vb("{{ARCHITECT_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{ARCHITECT_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{ARCHITECT_ADDRESS_LINE_3}}")}</p>
</div>`,
  }
)}
`
  ),

  "Supervision Memo Of Licensed Plumber.html": wrap(
    "Supervision Memo Of Licensed Plumber",
    `
<div class="annexure">ANNEXURE–6</div>
<div class="form-title">SUPERVISION MEMO OF LICENSED PLUMBER</div>
${bpToBlock()}
<p>Subject:&nbsp;&nbsp;${vb("Acceptance of Supervision")}</p>
<p>Reference:&nbsp;&nbsp;Proposal File No. ${vb("{{FILE_NO}}")}</p>
<table class="meta-table">
<tr><td class="lbl">Full Particular of the work</td><td>${vb("{{PROJECT_TITLE}}")}</td></tr>
${surveyMetaRow()}
${placeMetaRow()}
<tr><td class="lbl">Type of Development</td><td>${vb("{{TYPE_OF_DEVELOPMENT}}")}</td></tr>
<tr><td class="lbl">Road Name</td><td>${vb("{{PROPERTY_ADDRESS}}")}</td></tr>
<tr><td class="lbl">Ward</td><td>${vb("{{WARD}}")}</td></tr>
</table>
<p>This is in reference to the letter of appointment issued by the ${vb("{{OWNER_OR_DEVELOPER}}")}, I hereby confirm having agreed to act as Licensed Plumber for the above proposal.</p>
<p>This is for your information &amp; record please.</p>
${closing(
  `<p>For ${vb("{{CONSULTANT_FIRM}}")},</p>
${dscSlot("consultant")}
${consultantSignerBlock("Licensed Plumber", "{{LICENSED_PLUMBER}}")}`,
  {
    cc: `<div class="cc">
<p><span class="bold">C.C. to:</span></p>
<p>1. ${vb("{{OWNER_OR_DEVELOPER}}")}</p>
<p>${vb("{{APPLICANT_NAME}}")},</p>
<p>${vb("{{OWNER_FIRM}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_3}}")}</p>
<p>2. Architect/ Licensed Surveyor</p>
<p>${vb("{{ARCHITECT_LS_NAME}}")}</p>
<p>${vb("{{ARCHITECT_LS_OFFICE}}")}</p>
<p>${vb("{{ARCHITECT_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{ARCHITECT_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{ARCHITECT_ADDRESS_LINE_3}}")}</p>
</div>`,
  }
)}
`
  ),

  "Supervision Memo Of Site Supervisor.html": wrap(
    "Supervision Memo Of Site Supervisor",
    `
<div class="annexure">ANNEXURE–6</div>
<div class="form-title">SUPERVISION MEMO OF SITE SUPERVISOR</div>
${bpToBlock()}
<p>Subject:&nbsp;&nbsp;${vb("Acceptance of Supervision")}</p>
<p>Reference:&nbsp;&nbsp;Proposal File No. ${vb("{{FILE_NO}}")}</p>
<table class="meta-table">
<tr><td class="lbl">Full Particular of the work</td><td>${vb("{{PROJECT_TITLE}}")}</td></tr>
${surveyMetaRow()}
${placeMetaRow()}
<tr><td class="lbl">Type of Development</td><td>${vb("{{TYPE_OF_DEVELOPMENT}}")}</td></tr>
<tr><td class="lbl">Road Name</td><td>${vb("{{PROPERTY_ADDRESS}}")}</td></tr>
<tr><td class="lbl">Ward</td><td>${vb("{{WARD}}")}</td></tr>
</table>
<p>With reference to the letter of my appointment dated ${vb("{{APPOINTMENT_DATE}}")} addressed to you, by the ${vb("{{OWNER_OR_DEVELOPER}}")}, I hereby confirm that, I have agreed to act as the Site Supervisor for the above proposal.</p>
<p>I further confirm that the workmanship and material quality and material testing shall be in conformity with the provisions of I.S. standards and the development work shall be as per approved plans and the structural design etc.</p>
<p>This is for your information &amp; record please.</p>
${closing(
  `<p>For ${vb("{{CONSULTANT_FIRM}}")},</p>
${dscSlot("consultant")}
${consultantSignerBlock("Site Supervisor", "{{SITE_SUPERVISOR}}")}`,
  {
    cc: `<div class="cc">
<p><span class="bold">C.C. to:</span></p>
<p>1. ${vb("{{OWNER_OR_DEVELOPER}}")}</p>
<p>${vb("{{APPLICANT_NAME}}")},</p>
<p>${vb("{{OWNER_FIRM}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_3}}")}</p>
<p>2. Architect/ Licensed Surveyor</p>
<p>${vb("{{ARCHITECT_LS_NAME}}")}</p>
<p>${vb("{{ARCHITECT_LS_OFFICE}}")}</p>
<p>${vb("{{ARCHITECT_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{ARCHITECT_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{ARCHITECT_ADDRESS_LINE_3}}")}</p>
</div>`,
  }
)}
`
  ),

  "Form of Notice for Start of Work.html": wrap(
    "Form of Notice for Start of Work",
    `
<div class="annexure">ANNEXURE 13</div>
<div class="form-subtitle">[Regulations No.11(2) and Section 347(i)(a) of the Mumbai Municipal Corporation Act, 1888]</div>
<div class="form-title">Form of Notice for Start of Work</div>
${bpToBlock()}
<p>Sir,</p>
<p>The development work/erection/re-erection/demolition or material alteration in/of Building No. ${vb("{{BUILDING_NO}}")} on/in ${plotLine()} ${divisionLine()} situated at ${vb("{{PROPERTY_ADDRESS}}")} Road/Street ${vb("{{PROPERTY_ADDRESS}}")} Ward ${vb("{{WARD}}")} will start on ${vb("{{WORK_START_DATE}}")} in accordance with your permission No. ${vb("{{FILE_NO}}")} dated ${vb("{{LAST_APPROVAL_NO}}")}, under the supervision of ${vb("{{ARCHITECTS_NAME}}")} Licensed Surveyor/ Engineer /Structural Engineer/ Supervisor, or Architect License No. ${vb("{{ARCHITECT_LS_REG_NO}}")} and in accordance with the plans sanctioned.</p>
${closing(
  `${dscSlot("owner")}
<p>Name of the ${vb("{{OWNER_OR_DEVELOPER}}")}: ${vb("{{OWNER_NAME}}")}</p>
<p>Address of ${vb("{{OWNER_OR_DEVELOPER}}")}: ${vb("{{OWNER_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_3}}")}</p>
<p>Date: ${vb("{{LETTER_DATE}}")}</p>`,
  { thanking: false, yours: "Yours faithfully," }
)}
`
  ),

  "Intimation of Completion of Work upto Plinth Level.html": wrap(
    "Intimation of Completion of Work upto Plinth Level",
    `
<div class="annexure">ANNEXURE 14</div>
<div class="form-subtitle">[Regulations No.11(4)]</div>
<div class="form-title">Form of intimation of Completion of Work upto Plinth Level</div>
${bpToBlock()}
<p>Sir,</p>
<p>The construction upto plinth/column upto plinth level has been completed in Building No. ${vb("{{BUILDING_NO}}")} on/in ${plotLine()} ${divisionLine()} Road/Street ${vb("{{PROPERTY_ADDRESS}}")} Ward ${vb("{{WARD}}")} in accordance with your permission No. ${vb("{{FILE_NO}}")} dated ${vb("{{LAST_APPROVAL_NO}}")} under my supervision and in accordance with the sanctioned plan.</p>
<p>Please check the completed work and permit me to proceed with the rest of the work.</p>
${closing(`<p>For ${vb("{{CONSULTANT_FIRM}}")},</p>
${dscSlot("consultant")}
${architectSignerBlock({ includeDate: false })}`)}
`
  ),

  "Development completion certificate.html": wrap(
    "Development completion certificate",
    `
<div class="annexure">ANNEXURE 14</div>
<div class="form-subtitle">(Regulations No.11(6)&amp; (7))</div>
<div class="form-title">Form for Development completion certificate</div>
${bpToBlock()}
<p>Sir,</p>
<p>I certify that the erection/re-erection or part/full development work in/on building/ part building No. ${vb("{{BUILDING_NO}}")} on/in ${plotLine()} ${divisionLine()} situated at ${vb("{{PROPERTY_ADDRESS}}")} Road/Street ${vb("{{PROPERTY_ADDRESS}}")} Ward ${vb("{{WARD}}")} has been supervised by me and has been completed on according to the plans sanctioned (office communication No. ${vb("{{FILE_NO}}")} dated ${vb("{{LAST_APPROVAL_NO}}")}).</p>
<p>The work has been completed to my best satisfaction the workmanship and all the materials (type and grade) have been used strictly in accordance with general and detailed specifications. No provisions of the Act or Development Control Regulations or no requisitions made, conditions prescribed or orders issued thereunder have been transgressed in the course of the work. I am enclosing three copies of the completion plans, one of which is cloth mounted. The building is fit for occupancy for which it has been erected/re-erected or altered, constructed and enlarged.</p>
<p>I have to request you to arrange for the inspection and give permission for the occupation of the building.</p>
${closing(`<p>For ${vb("{{CONSULTANT_FIRM}}")},</p>
${dscSlot("consultant")}
${architectSignerBlock()}`)}
`
  ),

  "Owners Plot Area Affidavit.html": wrap(
    "Owner's Plot Area Affidavit",
    `
<div class="stamp-note">ON Rs. 100/- Stamp paper and not on letter head</div>
<div class="annexure">ANNEXURE 4</div>
<div class="form-title">Owner's Plot Area Affidavit</div>
${bpToBlock()}
<p>Subject:&nbsp;&nbsp;${vb("{{PROJECT_TITLE}}")}</p>
<p>Reference:&nbsp;&nbsp;Proposal File No. ${vb("{{FILE_NO}}")}</p>
<p>I/We, ${vb("{{SALUTATION}}")}${vb("{{APPLICANT_NAME}}")}}, ${vb("{{SIGNATORY_DESIGNATION}}")}, ${vb("{{OWNER_FIRM}}")} having its office at ${vb("{{COMMUNICATION_ADDRESS}}")} and possessing the rights of development by virtue Conveyance/ Lease/ Development Agreement/ Power of Attorney dated ${vb("{{DEVELOPMENT_RIGHTS_DATE}}")} for the property bearing Survey No. ${vb("{{S_NO}}")}, Hissa No. ${vb("{{H_NO}}")} &amp; ${plotLine()} of Village- ${vb("{{VILLAGE}}")} at ${vb("{{PROPERTY_ADDRESS}}")} in ${vb("{{WARD}}")} Ward, and having my residence/office at ${vb("{{OWNER_ADDRESS_LINE_1}}")}, do solemnly affirm and say as under:</p>
<p>I have submitted the plans through my Architect/Licensed Surveyor ${vb("{{ARCHITECT_LS_NAME}}")} having License No. ${vb("{{ARCHITECT_LS_REG_NO}}")} for development of the aforesaid property.</p>
<p>In order to verify the area, I have also carried out survey of the said plot through my Architect/ Licensed surveyor to ascertain the correctness of the area.</p>
<p>I say that my Architect/Licensed Surveyor has certified the said area on the basis of the property register card duly certified by the Superintendent of Land Records and/or on the basis survey carried out as per the boundaries of the property shown by me/us.</p>
<p>The said area works out to ${vb("{{PLOT_AREA}}")} Sq. M. (${vb("{{PLOT_AREA_WORDS}}")} Square Meters) and F.S.I is claimed for the plot area ${vb("{{PLOT_AREA}}")} Sq. M. (${vb("{{PLOT_AREA_WORDS}}")} Square Meters)</p>
<p>It may also be stated here that I/we do not hold /own any contiguous land with the subject land.</p>
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
};

await mkdir(OUT, { recursive: true });
for (const [name, html] of Object.entries(files)) {
  const dest = path.join(OUT, name);
  await writeFile(dest, html, "utf8");
  console.log("wrote", name);
}
console.log("done", Object.keys(files).length, "files →", OUT);
