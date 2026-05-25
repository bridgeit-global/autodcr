import forge from "node-forge";

export interface SignerCertificateInfo {
  commonName: string;
  organization: string;
  state: string;
  postalCode: string;
  serialNumber: string;
  issuer: string;
  validFrom: string;
  validTo: string;
}

export interface PdfSignatureInfo {
  isSigned: boolean;
  signatureCount: number;
  signers: SignerDetail[];
}

export interface SignerDetail {
  name: string;
  certificate: SignerCertificateInfo | null;
}

/**
 * Extracts digital signature information from a PDF:
 * - Whether it is signed
 * - How many completed signatures exist
 * - Who signed (from /Name field and X.509 certificate inside PKCS#7 blob)
 */
export function getPdfSignatureInfo(pdfBytes: Uint8Array | ArrayBuffer): PdfSignatureInfo {
  const bytes = pdfBytes instanceof ArrayBuffer ? new Uint8Array(pdfBytes) : pdfBytes;
  const text = new TextDecoder("latin1").decode(bytes);

  const signers: SignerDetail[] = [];

  const objPattern = /\d+ \d+ obj[\s\S]*?endobj/g;
  let objMatch: RegExpExecArray | null;

  while ((objMatch = objPattern.exec(text)) !== null) {
    const block = objMatch[0];

    if (!block.includes("/ByteRange")) continue;

    const contentsMatch = block.match(/\/Contents\s*<([0-9a-fA-F\s]*?)>/);
    if (!contentsMatch) continue;
    const hex = contentsMatch[1].replace(/\s+/g, "");
    if (hex.length === 0 || !/[1-9a-fA-F]/.test(hex)) continue;

    const name = extractSignerName(block) || "Unknown Signer";
    const certificate = extractCertificateFromHex(hex);

    signers.push({ name, certificate });
  }

  return {
    isSigned: signers.length > 0,
    signatureCount: signers.length,
    signers,
  };
}

/**
 * Parse the PKCS#7/CMS hex blob and extract the end-entity signer certificate.
 * Uses multiple heuristics to identify the personal cert among CA/OCSP certs.
 */
function extractCertificateFromHex(hex: string): SignerCertificateInfo | null {
  try {
    let trimmed = hex.replace(/0+$/, "");
    if (trimmed.length % 2 !== 0) trimmed += "0";

    const der = forge.util.hexToBytes(trimmed);
    const asn1 = forge.asn1.fromDer(der);
    const cms = forge.pkcs7.messageFromAsn1(asn1) as unknown as {
      certificates?: forge.pki.Certificate[];
    };

    if (!cms.certificates || cms.certificates.length === 0) return null;

    const signerCert = findEndEntityCert(cms.certificates);

    return {
      commonName: getAttr(signerCert.subject, "CN") || "Unknown",
      organization: getAttr(signerCert.subject, "O") || "",
      state: getAttr(signerCert.subject, "ST") || "",
      postalCode: getAttr(signerCert.subject, "postalCode") || "",
      serialNumber: getAttr(signerCert.subject, "serialNumber") ||
        getAttr(signerCert.subject, "2.5.4.5") || "",
      issuer: getAttr(signerCert.issuer, "CN") || "",
      validFrom: signerCert.validity.notBefore.toISOString(),
      validTo: signerCert.validity.notAfter.toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Find the end-entity (personal) certificate from the chain.
 * Priority: cert with a serialNumber/PAN hash > cert whose CN is not a CA/OCSP name.
 */
function findEndEntityCert(certs: forge.pki.Certificate[]): forge.pki.Certificate {
  // Best match: cert that has a serialNumber attribute (PAN hash) — only personal DSCs have this
  const withSerial = certs.find((c: forge.pki.Certificate) => {
    const serial = getAttr(c.subject, "serialNumber") || getAttr(c.subject, "2.5.4.5");
    return serial.length > 0;
  });
  if (withSerial) return withSerial;

  // Fallback: exclude CA certs, OCSP certs, and root certs by CN pattern
  const personal = certs.find((c: forge.pki.Certificate) => {
    const cn = getAttr(c.subject, "CN");
    if (!cn) return false;
    const lower = cn.toLowerCase();
    return (
      !lower.includes(" ca ") &&
      !lower.includes("certifying authority") &&
      !lower.startsWith("cca") &&
      !lower.includes("ocsp") &&
      !lower.includes("india pki") &&
      !lower.includes("root")
    );
  });
  if (personal) return personal;

  return certs[certs.length - 1];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAttr(subject: any, name: string): string {
  const attr = subject.attributes.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => a.shortName === name || a.name === name || a.type === name
  );
  return typeof attr?.value === "string" ? attr.value : "";
}

function extractSignerName(block: string): string | null {
  const literalMatch = block.match(/\/Name\s*\(([^)]*)\)/);
  if (literalMatch) return decodePdfLiteralString(literalMatch[1]);

  const hexMatch = block.match(/\/Name\s*<([0-9a-fA-F\s]*)>/);
  if (hexMatch) return decodePdfHexString(hexMatch[1]);

  return null;
}

function decodePdfLiteralString(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")");
}

function decodePdfHexString(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  let out = "";
  for (let i = 0; i < clean.length - 1; i += 2) {
    out += String.fromCharCode(parseInt(clean.substring(i, i + 2), 16));
  }
  return out;
}

/** Simple boolean check — kept for backward compatibility. */
export function isPdfDigitallySigned(pdfBytes: Uint8Array | ArrayBuffer): boolean {
  return getPdfSignatureInfo(pdfBytes).isSigned;
}
