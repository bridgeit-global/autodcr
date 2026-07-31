import forge from "node-forge";
import type { CertInfo } from "@/app/lib/bridge/protocol";

export type DscValidity = {
  notBefore: Date | null;
  notAfter: Date | null;
};

export type DscValidityIssue = {
  kind: "expired" | "notYetValid";
  message: string;
  /** Validity boundary that caused the issue (notAfter for expired, notBefore for not-yet-valid). */
  relevantDate: Date | null;
};

function formatValidityDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseDateLoose(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCertFromDerBase64(derBase64: string): forge.pki.Certificate | null {
  const trimmed = derBase64.trim();
  if (!trimmed) return null;
  try {
    const derBytes = forge.util.decode64(trimmed);
    const asn1 = forge.asn1.fromDer(derBytes);
    return forge.pki.certificateFromAsn1(asn1);
  } catch {
    return null;
  }
}

/** Read notBefore / notAfter from DER (preferred) or host string fields. */
export function getDscValidity(cert: Pick<CertInfo, "derBase64" | "notBefore" | "notAfter">): DscValidity {
  if (cert.derBase64?.trim()) {
    const forgeCert = parseCertFromDerBase64(cert.derBase64);
    if (forgeCert) {
      return {
        notBefore: forgeCert.validity.notBefore ?? null,
        notAfter: forgeCert.validity.notAfter ?? null,
      };
    }
  }
  return {
    notBefore: parseDateLoose(cert.notBefore),
    notAfter: parseDateLoose(cert.notAfter),
  };
}

/** Returns a user-facing issue when the DSC is outside its validity window. */
export function getDscValidityIssue(
  cert: Pick<CertInfo, "derBase64" | "notBefore" | "notAfter">
): DscValidityIssue | null {
  const { notBefore, notAfter } = getDscValidity(cert);
  const now = Date.now();

  if (notAfter && now > notAfter.getTime()) {
    return {
      kind: "expired",
      relevantDate: notAfter,
      message: `DSC validity has expired on ${formatValidityDate(notAfter)}. Renew or use a valid digital signature certificate to sign.`,
    };
  }
  if (notBefore && now < notBefore.getTime()) {
    return {
      kind: "notYetValid",
      relevantDate: notBefore,
      message: `DSC is not yet valid (valid from ${formatValidityDate(notBefore)}). Use a digital signature certificate that is currently valid to sign.`,
    };
  }
  return null;
}

/**
 * Hard block in production when the DSC is outside its validity window.
 * In development, no-op so the UI can offer Continue anyway after showing the same message.
 */
export function assertDscValidForSigning(
  cert: Pick<CertInfo, "derBase64" | "notBefore" | "notAfter">
): void {
  const issue = getDscValidityIssue(cert);
  if (!issue) return;
  if (process.env.NODE_ENV === "production") {
    throw new Error(issue.message);
  }
}
