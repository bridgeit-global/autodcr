import forge from "node-forge";

export type DscPanCertInfo = {
  /** SHA-256(PAN) hex from subject serialNumber / OID 2.5.4.5 */
  panHash: string;
  commonName: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAttr(subject: any, name: string): string {
  const attr = subject?.attributes?.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => a.shortName === name || a.name === name || a.type === name
  );
  return typeof attr?.value === "string" ? attr.value : "";
}

/**
 * Extract the Indian DSC PAN hash (subject serialNumber) from a certificate DER.
 * Plaintext PAN is never present — only SHA-256(PAN) hex.
 */
export function extractPanHashFromCertDer(derBase64: string): DscPanCertInfo {
  const trimmed = derBase64.trim();
  if (!trimmed) {
    throw new Error("DSC certificate DER is missing. Reconnect the token and retry.");
  }

  let derBytes: string;
  try {
    derBytes = forge.util.decode64(trimmed);
  } catch {
    throw new Error("Could not decode DSC certificate. Reconnect the token and retry.");
  }

  let cert: forge.pki.Certificate;
  try {
    const asn1 = forge.asn1.fromDer(derBytes);
    cert = forge.pki.certificateFromAsn1(asn1);
  } catch {
    throw new Error("Could not parse DSC certificate. Reconnect the token and retry.");
  }

  const panHash =
    getAttr(cert.subject, "serialNumber") || getAttr(cert.subject, "2.5.4.5") || "";
  if (!panHash) {
    throw new Error(
      "This DSC does not contain a PAN hash (subject serialNumber). Use a personal DSC token."
    );
  }

  return {
    panHash: panHash.trim().toLowerCase(),
    commonName: getAttr(cert.subject, "CN") || "Unknown",
  };
}

/** Pick PAN from auth user metadata (`pan`, fallback `pan_no`). */
export function pickPanFromUserMetadata(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const m = meta as Record<string, unknown>;
  const pan =
    (typeof m.pan === "string" ? m.pan : "") ||
    (typeof m.pan_no === "string" ? m.pan_no : "");
  return pan.trim().toUpperCase();
}

export function isValidPanFormat(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase());
}
