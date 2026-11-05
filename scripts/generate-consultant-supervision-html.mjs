/**
 * Generate supervision-memo.html under html/General/consultants/<role>/.
 * Also writes notice-start-of-work.html for each catalog appointment role, and
 * architect-only plot-area-certificate.html (moved off Document Checklist).
 * Appointment/acceptance HTML are maintained as copies in the same folders.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "html", "General", "consultants");

const CSS = `
@page { size:A4; margin:17mm; }
*{box-sizing:border-box}
/* Match pipeline densify: equal 10.5pt, tight lh, near-zero vertical air. */
body{margin:0;background:#fff;color:#111;font-family:"Times New Roman",Times,serif;font-size:10.5pt;line-height:1.06}
.page{width:210mm;min-height:0;margin:14px auto;background:#fff;padding:17mm}
.form-title{text-align:center;font-weight:bold;text-decoration:underline;font-size:11.5pt;margin:0 0 1px;line-height:1.05}
.annexure{text-align:center;font-weight:bold;margin:0;line-height:1.05;font-size:10.5pt}
.bold{font-weight:bold}
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
.dsc-stamp-slot--owner{margin-top:2px;margin-bottom:2px}
.form-subtitle{text-align:center;font-size:10.5pt;margin:0 0 2px;line-height:1.05}
@media print{body{background:#fff}.page{width:auto;min-height:auto;margin:0;padding:0}}
`.trim();

const vb = (t) => `<span class="value-bold">${t}</span>`;
const dscSlot = () => `<div class="dsc-stamp-slot" aria-hidden="true"></div>`;
const architectSignerBlock = () => `<div class="architect-block">
<p class="signer-role">${vb("{{ARCHITECT_OR_LS_ROLE}}")}</p>
<p class="meta-line"><span class="meta-label">Name:</span> ${vb("{{ARCHITECT_LS_NAME}}")}</p>
<p class="meta-line"><span class="meta-label">{{ARCHITECT_OR_LS_REG_LABEL}}:</span> ${vb("{{ARCHITECT_LS_REG_NO}}")}</p>
<p class="meta-line"><span class="meta-label">Valid upto:</span> ${vb("{{ARCHITECT_LS_VALIDITY}}")}</p>
<p>Date: ${vb("{{LETTER_DATE}}")}</p>
</div>`;
const architectCcBlock = () => architectSignerBlock();
const consultantSignerBlock = (roleLabel, nameToken) => `<div class="consultant-block">
<p class="signer-role">${roleLabel}</p>
<p class="meta-line"><span class="meta-label">Name:</span> ${vb(nameToken)}</p>
<p class="meta-line"><span class="meta-label">Reg. No.:</span> ${vb("{{REG_NO}}")}</p>
<p class="meta-line"><span class="meta-label">Valid upto:</span> ${vb("{{VALIDITY}}")}</p>
<p>Date: ${vb("{{LETTER_DATE}}")}</p>
</div>`;
const closing = (sigInner, cc) => `<div class="closing">
<p>Thanking you,</p>
<p>Yours Faithfully,</p>
<div class="sig">
${sigInner}
</div>
${cc}
</div>`;
const bpToBlock = () => `<div class="to-block">
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
const metaTable = () => `<table class="meta-table">
<tr><td class="lbl">Full Particular of the work</td><td>${vb("{{PROJECT_TITLE}}")}</td></tr>
<tr><td class="lbl">Plot No./ C.S. No./ C.T.S. No. / F.P No.</td><td>${vb("{{PLOT_NO}}")} / ${vb("{{CS_NO}}")} / ${vb("{{CTS_NO}}")} / ${vb("{{FP_NO}}")}</td></tr>
<tr><td class="lbl">Division/ Village/ T.P. Scheme No.</td><td>${vb("{{DIVISION}}")} / ${vb("{{VILLAGE}}")} / ${vb("{{TPS_NO}}")}</td></tr>
<tr><td class="lbl">Type of Development</td><td>${vb("{{TYPE_OF_DEVELOPMENT}}")}</td></tr>
<tr><td class="lbl">Road Name</td><td>${vb("{{PROPERTY_ADDRESS}}")}</td></tr>
<tr><td class="lbl">Ward</td><td>${vb("{{WARD}}")}</td></tr>
</table>`;
const ownerCcLines = () => `<p><span class="bold">{{OWNER_OR_DEVELOPER}}</span></p>
<p>${vb("{{APPLICANT_NAME}}")},</p>
<p>${vb("{{OWNER_FIRM}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_3}}")}</p>`;
const wrap = (title, body) => `<!doctype html>
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

const roles = [
  { slug: "architect", title: "Architect", kind: "architect" },
  { slug: "licensed-surveyor", title: "Licensed Surveyor", kind: "architect" },
  {
    slug: "structural-engineer",
    title: "Structural Engineer",
    nameToken: "{{STRUCTURAL_ENGINEER}}",
    annexure: "ANNEXURE–5",
    kind: "dated",
    actAs: "the Consulting Structural Engineer",
    extra:
      "I further confirm that the structural design and calculations shall be in conformity with the provisions of I.S. Code nos. 1875, 1893 &amp; 4326 taking into consideration the Seismic Forces etc. as required by the planning authority.",
  },
  {
    slug: "plumber",
    title: "Licensed Plumber",
    nameToken: "{{LICENSED_PLUMBER}}",
    annexure: "ANNEXURE–6",
    kind: "plumber",
    actAs: "Licensed Plumber",
  },
  {
    slug: "site-supervisor",
    title: "Site Supervisor",
    nameToken: "{{SITE_SUPERVISOR}}",
    annexure: "ANNEXURE–6",
    kind: "dated",
    actAs: "the Site Supervisor",
    extra:
      "I further confirm that the workmanship and material quality and material testing shall be in conformity with the provisions of I.S. standards and the development work shall be as per approved plans and the structural design etc.",
  },
  {
    slug: "fire-safety-consultant",
    title: "Fire Safety Consultant",
    nameToken: "{{FIRE_SAFETY_CONSULTANT}}",
    annexure: "ANNEXURE–6",
    kind: "dated",
    actAs: "Fire Safety Consultant",
  },
  {
    slug: "me-consultant",
    title: "M&E Consultant",
    nameToken: "{{ME_CONSULTANT}}",
    annexure: "ANNEXURE–6",
    kind: "dated",
    actAs: "M&amp;E Consultant",
  },
  {
    slug: "landscape-consultant",
    title: "Landscape Consultant",
    nameToken: "{{CONSULTANT_NAME}}",
    annexure: "ANNEXURE–6",
    kind: "dated",
    actAs: "Landscape Consultant",
  },
  {
    slug: "geotechnical-consultant",
    title: "Geotechnical Consultant",
    nameToken: "{{CONSULTANT_NAME}}",
    annexure: "ANNEXURE–6",
    kind: "dated",
    actAs: "Geotechnical Consultant",
  },
  {
    slug: "environmental-consultant",
    title: "Environmental Consultant",
    nameToken: "{{CONSULTANT_NAME}}",
    annexure: "ANNEXURE–6",
    kind: "dated",
    actAs: "Environmental Consultant",
  },
  {
    slug: "town-planner",
    title: "Town Planner",
    nameToken: "{{CONSULTANT_NAME}}",
    annexure: "ANNEXURE–6",
    kind: "dated",
    actAs: "Town Planner",
  },
  {
    slug: "pmc-project-manager",
    title: "PMC / Project Manager",
    nameToken: "{{CONSULTANT_NAME}}",
    annexure: "ANNEXURE–6",
    kind: "dated",
    actAs: "PMC / Project Manager",
  },
  {
    slug: "parking-consultant",
    title: "Parking Consultant",
    nameToken: "{{TRAFFIC_PARKING_CONSULTANT}}",
    annexure: "ANNEXURE–6",
    kind: "dated",
    actAs: "Parking Consultant",
  },
  {
    slug: "rainwater-consultant",
    title: "Rainwater Consultant",
    nameToken: "{{CONSULTANT_NAME}}",
    annexure: "ANNEXURE–6",
    kind: "dated",
    actAs: "Rainwater Consultant",
  },
  {
    slug: "horticulturist",
    title: "Horticulturist",
    nameToken: "{{HORTICULTURIST}}",
    annexure: "ANNEXURE–6",
    kind: "dated",
    actAs: "Horticulturist",
  },
];

function architectBody() {
  return `
<div class="annexure">ANNEXURE 2</div>
<div class="form-title">FORM OF SUPERVISION ACCEPTANCE</div>
${bpToBlock()}
<p>Subject:&nbsp;&nbsp;${vb("Acceptance of Supervision")}</p>
<p>Reference:&nbsp;&nbsp;Proposal File No. ${vb("{{FILE_NO}}")}</p>
<p>Dear Sir,</p>
<p class="body-indent">The development work of the</p>
${metaTable()}
<p class="body-indent">will be carried out under my supervision. All the materials (type and grade) and the workmanship of the work will generally tally with the general specifications submitted along with the plans and the work will be carried out according to the sanctioned plans. I shall be responsible for the execution of the work in all respects.</p>
<p class="body-indent">This is for your information &amp; record please.</p>
${closing(
  `<p>For ${vb("{{CONSULTANT_FIRM}}")},</p>
${dscSlot()}
${architectSignerBlock()}`,
  `<div class="cc">
<p><span class="cc-label">C.C. to:</span>&nbsp;&nbsp;<span class="bold">{{OWNER_OR_DEVELOPER}}</span></p>
<p>${vb("{{APPLICANT_NAME}}")},</p>
<p>${vb("{{OWNER_FIRM}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_3}}")}</p>
</div>`
)}
`;
}

function consultantBody(r) {
  const bodyPara =
    r.kind === "plumber"
      ? `<p class="body-indent">This is in reference to the letter of appointment issued by the ${vb("{{OWNER_OR_DEVELOPER}}")}, I hereby confirm having agreed to act as ${r.actAs} for the above proposal.</p>`
      : `<p class="body-indent">With reference to the letter of our appointment dated ${vb("{{APPOINTMENT_DATE}}")} addressed to you, by the ${vb("{{OWNER_OR_DEVELOPER}}")}, I hereby confirm that I have agreed to act as ${r.actAs} for the above proposal.</p>`;
  const extra = r.extra ? `<p class="body-indent">${r.extra}</p>` : "";
  return `
<div class="annexure">${r.annexure}</div>
<div class="form-title">SUPERVISION MEMO OF ${r.title.toUpperCase()}</div>
${bpToBlock()}
<p>Subject:&nbsp;&nbsp;${vb("Acceptance of Supervision")}</p>
<p>Reference:&nbsp;&nbsp;Proposal File No. ${vb("{{FILE_NO}}")}</p>
${metaTable()}
${bodyPara}
${extra}
<p class="body-indent">This is for your information &amp; record please.</p>
${closing(
  `<p>For ${vb("{{CONSULTANT_FIRM}}")},</p>
${dscSlot()}
${consultantSignerBlock(r.title, r.nameToken)}`,
  `<div class="cc">
<p><span class="cc-label">C.C. to:</span></p>
${ownerCcLines()}
${architectCcBlock()}
</div>`
)}
`;
}

function plotAreaCertificateBody() {
  return `
<div class="annexure">ANNEXURE 3</div>
<div class="form-title">PLOT AREA CERTIFICATE</div>
${bpToBlock()}
<p>Subject:&nbsp;&nbsp;${vb("Acceptance of Supervision")}</p>
<p>Reference:&nbsp;&nbsp;Proposal File No. ${vb("{{FILE_NO}}")}</p>
${metaTable()}
<p class="body-indent">I have submitted a proposal on behalf of my/our client Shri/M/s. ${vb("{{CLIENT_NAME}}")} for the proposed development on the above referred plot.</p>
<p class="body-indent">The area of the plot is ${vb("{{PLOT_AREA}}")} sq. m as per the P.R. Cards obtained from city Survey office dated ${vb("{{DATE_OF_PRC}}")}.</p>
<p class="body-indent">In order to verify the plot area, I/We have carried out the survey of the said plot through our staff to ascertain correctness of the area mentioned in the Property Register Card. The said survey has been carried out on the basis of the boundaries of the plot shown by the Owner/Client.</p>
<p class="body-indent">The said area as per the survey now works out to ${vb("{{PLOT_AREA}}")} sq. m. and F.S.I. is claimed for the plot area ${vb("{{PLOT_AREA}}")} sq. m.</p>
${closing(
  `<p>For ${vb("{{CONSULTANT_FIRM}}")},</p>
${dscSlot()}
${architectSignerBlock()}`,
  ""
)}
`;
}

for (const r of roles) {
  const dir = path.join(ROOT, r.slug);
  await mkdir(dir, { recursive: true });
  const title = `Supervision Memo Of ${r.title}`;
  const body = r.kind === "architect" ? architectBody() : consultantBody(r);
  await writeFile(path.join(dir, "supervision-memo.html"), wrap(title, body), "utf8");
  console.log("wrote", path.join("General/consultants", r.slug, "supervision-memo.html"));
}

function noticeStartOfWorkBody() {
  return `
<div class="annexure">ANNEXURE 13</div>
<div class="form-subtitle">[Regulations No.11(2) and Section 347(i)(a) of the Mumbai Municipal Corporation Act, 1888]</div>
<div class="form-title">Form of Notice for Start of Work</div>
${bpToBlock()}
<p>Sir,</p>
<p class="body-indent">The development work/erection/re-erection/demolition or material alteration in/of Building No. ${vb("{{BUILDING_NO}}")} on/in ${vb("{{PLOT_CS_CTS_NO}}")} ${vb("{{VILLAGE_DIVISION}}")} situated at ${vb("{{PROPERTY_ADDRESS}}")} Road/Street ${vb("{{PROPERTY_ADDRESS}}")} Ward ${vb("{{WARD}}")} will start on ${vb("{{WORK_START_DATE}}")} in accordance with your permission No. ${vb("{{FILE_NO}}")} dated ${vb("{{LAST_APPROVAL_NO}}")}, under the supervision of ${vb("{{ARCHITECTS_NAME}}")} Licensed Surveyor/ Engineer /Structural Engineer/ Supervisor, or Architect License No. ${vb("{{ARCHITECT_LS_REG_NO}}")} and in accordance with the plans sanctioned.</p>
<div class="closing">
<p>Yours faithfully,</p>
<div class="sig">
<div class="dsc-stamp-slot dsc-stamp-slot--owner" aria-hidden="true"></div>
<p>Name of the ${vb("{{OWNER_OR_DEVELOPER}}")}: ${vb("{{OWNER_NAME}}")}</p>
<p>Address of ${vb("{{OWNER_OR_DEVELOPER}}")}: ${vb("{{OWNER_ADDRESS_LINE_1}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_2}}")}</p>
<p>${vb("{{OWNER_ADDRESS_LINE_3}}")}</p>
<p>Date: ${vb("{{LETTER_DATE}}")}</p>
</div>
</div>
`;
}

/** Roles that have an active appointment_letter catalog type (not parking/rainwater/hort). */
const noticeRoles = roles.filter((r) =>
  [
    "architect",
    "licensed-surveyor",
    "structural-engineer",
    "plumber",
    "site-supervisor",
    "fire-safety-consultant",
    "me-consultant",
    "landscape-consultant",
    "geotechnical-consultant",
    "environmental-consultant",
    "town-planner",
    "pmc-project-manager",
  ].includes(r.slug)
);

for (const r of noticeRoles) {
  const dir = path.join(ROOT, r.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "notice-start-of-work.html"),
    wrap("Form of Notice for Start of Work", noticeStartOfWorkBody()),
    "utf8"
  );
  console.log("wrote", path.join("General/consultants", r.slug, "notice-start-of-work.html"));
}

{
  const dir = path.join(ROOT, "architect");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "plot-area-certificate.html"),
    wrap("Plot Area Certificate", plotAreaCertificateBody()),
    "utf8"
  );
  console.log("wrote", "General/consultants/architect/plot-area-certificate.html");
}
