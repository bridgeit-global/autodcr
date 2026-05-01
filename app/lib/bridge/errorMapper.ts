/**
 * Maps the bridge / native host error codes to user-friendly copy plus an
 * actionable hint and a `retryable` flag the UI can use to decide whether to
 * keep the user's selection (e.g. a `PIN_CANCELLED` should not wipe the cert
 * choice).
 */

import { BridgeError } from "./bridgeClient";

export type BridgeErrorCode =
  | "NO_EXTENSION"
  | "NO_WINDOW"
  | "ABORTED"
  | "NATIVE_TIMEOUT"
  | "NATIVE_DISCONNECTED"
  | "NATIVE_SEND_FAILED"
  | "INVALID_REQUEST"
  | "INVALID_PAYLOAD"
  | "UNKNOWN_JOB"
  | "INVALID_CHUNK_INDEX"
  | "CERT_NOT_FOUND"
  | "PIN_CANCELLED"
  | "PIN_INCORRECT"
  | "PDF_INVALID"
  | "CMS_BUILD_FAILED"
  | "NO_TOKEN"
  | "NO_CERT_SELECTED"
  | `PKCS11_${string}`;

export interface MappedError {
  code?: string;
  message: string;
  hint?: string;
  retryable: boolean;
}

const TABLE: Record<string, Omit<MappedError, "code">> = {
  NO_EXTENSION: {
    message: "AutoDCR signer extension not detected.",
    hint: "Install the AutoDCR signer Chrome extension and reload this page.",
    retryable: true,
  },
  NO_WINDOW: {
    message: "Signing bridge is unavailable in this environment.",
    retryable: false,
  },
  ABORTED: {
    message: "Signing was cancelled.",
    retryable: true,
  },
  NATIVE_TIMEOUT: {
    message: "Native host did not respond in time.",
    hint: "Make sure the AutoDCR native host is installed and running, then retry.",
    retryable: true,
  },
  NATIVE_DISCONNECTED: {
    message: "Lost connection to the native host.",
    hint: "Reinstall or restart the AutoDCR native host, then retry.",
    retryable: true,
  },
  NATIVE_SEND_FAILED: {
    message: "Failed to send request to the native host.",
    hint: "Check extension/native-host installation and retry signing.",
    retryable: true,
  },
  INVALID_REQUEST: {
    message: "The bridge rejected this request format.",
    hint: "Reload the page and retry. If it persists, update extension and app together.",
    retryable: false,
  },
  INVALID_PAYLOAD: {
    message: "The signing request was rejected by the native host.",
    hint: "Reload the page and try again. If this persists, report the issue.",
    retryable: false,
  },
  UNKNOWN_JOB: {
    message: "The native host could not find this signing job.",
    hint: "Start a fresh signing attempt.",
    retryable: true,
  },
  INVALID_CHUNK_INDEX: {
    message: "A PDF chunk arrived out of sequence.",
    hint: "Restart signing to create a new job and resend chunks in order.",
    retryable: true,
  },
  CERT_NOT_FOUND: {
    message: "Selected certificate is no longer available on this token.",
    hint: "Refresh certificates and select a valid certificate again.",
    retryable: true,
  },
  PIN_CANCELLED: {
    message: "PIN entry was cancelled.",
    hint: "Click \"Sign here\" again and enter your DSC PIN to continue.",
    retryable: true,
  },
  PIN_INCORRECT: {
    message: "Incorrect DSC PIN.",
    hint: "Double-check the PIN for this token and try again.",
    retryable: true,
  },
  NO_TOKEN: {
    message: "No DSC token detected.",
    hint: "Insert your USB token or configure the PKCS#11 module, then retry.",
    retryable: true,
  },
  PDF_INVALID: {
    message: "The uploaded PDF is invalid or unsupported for signing.",
    hint: "Try a standard PDF file and ensure it is not corrupted.",
    retryable: true,
  },
  CMS_BUILD_FAILED: {
    message: "Could not build CMS signature payload.",
    hint:
      "Likely certificate/private-key CKA_ID mismatch. Reselect slot and certificate, then retry. If it persists, verify token private key exists for the selected certId.",
    retryable: true,
  },
  NO_CERT_SELECTED: {
    message: "No certificate selected.",
    hint: "Pick a certificate from the dropdown before signing.",
    retryable: true,
  },
};

const PKCS11_PREFIX = "PKCS11_";

const fromCode = (code: string, originalMessage?: string): MappedError => {
  const entry = TABLE[code];
  if (entry) {
    return { code, ...entry };
  }
  if (code.startsWith(PKCS11_PREFIX)) {
    const detail = code.slice(PKCS11_PREFIX.length).replace(/_/g, " ").toLowerCase();
    return {
      code,
      message: originalMessage?.trim() || `PKCS#11 error: ${detail || "operation failed"}.`,
      hint: "Verify the token is connected, drivers are installed, and retry.",
      retryable: true,
    };
  }
  return {
    code,
    message: originalMessage?.trim() || "Native host request failed.",
    hint: "Try again. If the issue persists, restart the extension and native host.",
    retryable: true,
  };
};

/**
 * Normalise any thrown value (BridgeError, Error, string, plain object) into
 * a MappedError suitable for rendering in the UI.
 */
export const mapBridgeError = (input: unknown): MappedError => {
  if (input instanceof BridgeError) {
    if (input.code) return fromCode(input.code, input.message);
    return {
      message: input.message || "Native host request failed.",
      hint: "Try again. If the issue persists, restart the extension and native host.",
      retryable: true,
    };
  }
  if (input instanceof Error) {
    return {
      message: input.message || "Unexpected signing error.",
      retryable: true,
    };
  }
  if (typeof input === "string" && input.trim()) {
    return { message: input, retryable: true };
  }
  if (input && typeof input === "object") {
    const maybe = input as { code?: unknown; message?: unknown };
    const code = typeof maybe.code === "string" ? maybe.code : undefined;
    const message = typeof maybe.message === "string" ? maybe.message : undefined;
    if (code) return fromCode(code, message);
    if (message) return { message, retryable: true };
  }
  return { message: "Unexpected signing error.", retryable: true };
};

/**
 * Convenience: build a MappedError directly from a known code (used for
 * synthesised conditions like NO_EXTENSION).
 */
export const mappedErrorForCode = (code: BridgeErrorCode, message?: string): MappedError =>
  fromCode(code, message);
