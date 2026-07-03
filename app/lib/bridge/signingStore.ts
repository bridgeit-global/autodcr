/**
 * React hook owning all client-side state for the DSC signing modal.
 *
 * The hook exposes the same field names the legacy inline implementation
 * used (`dscStatus`, `dscCertificates`, `selectedDsc`, `dscPin`, `dscError`,
 * `dscLoading`, `isSigning`, `isPingingConnector`, `connectorPingMessage`)
 * via a compatibility adapter, so the existing JSX in
 * `app/template/page.tsx` keeps working with no visual change while the
 * underlying transport speaks the new chunked PING / LIST_SLOTS /
 * LIST_CERTS / SIGN_PDF_* protocol.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cancelAllPending, isExtensionAvailable } from "./bridgeClient";
import { mapBridgeError, mappedErrorForCode, MappedError } from "./errorMapper";
import { blobToBase64 } from "./pdfChunker";
import { CertInfo, PingResult, SignPdfFinalResult } from "./protocol";
import { listAllCerts, pingHost, signPdf } from "./signingOrchestrator";

export interface DscStatus {
  connected: boolean;
  message: string;
}

/**
 * Shape preserved from the previous inline implementation so the existing
 * `<CustomSelect>` JSX in `app/template/page.tsx` does not have to change.
 *
 * - `slotIndex` mirrors the native PKCS#11 slot id.
 * - `certIndex` is the position of the cert within its slot (0-based).
 * - `cn` / `label` drive the dropdown label exactly as before.
 */
export interface LegacyDscCertificate {
  slotIndex: number;
  certIndex: number;
  cn?: string;
  label?: string;
}

export interface SelectedDsc {
  slotIndex: number;
  certIndex: number;
}

export interface SigningProgress {
  sent: number;
  total: number;
}

export interface UseSigningStore {
  dscStatus: DscStatus | null;
  dscCertificates: LegacyDscCertificate[];
  selectedDsc: SelectedDsc | null;
  dscPin: string;
  dscError: string | null;
  dscLoading: boolean;
  isSigning: boolean;
  isPingingConnector: boolean;
  connectorPingMessage: string | null;
  progress: SigningProgress | null;

  setSelectedDsc: (next: SelectedDsc | null) => void;
  setDscPin: (next: string) => void;
  setDscError: (next: string | null) => void;

  /** PING + LIST_SLOTS + LIST_CERTS for every slot, populates state. */
  initialize: () => Promise<void>;
  /** Standalone PING used by the "Check Connector" button. */
  checkConnectorHealth: () => Promise<void>;
  /** Drives SIGN_PDF_START / CHUNK / END. Returns null on failure. */
  signCurrentPdf: (
    blob: Blob,
    fileName?: string
  ) => Promise<SignPdfFinalResult | null>;

  cancelPending: () => void;
  reset: () => void;
}

const CN_RE = /CN\s*=\s*([^,]+)/i;

const extractCn = (cert: CertInfo): string | undefined => {
  if (cert.subject) {
    const match = CN_RE.exec(cert.subject);
    if (match?.[1]) return match[1].trim();
    return cert.subject;
  }
  return undefined;
};

const buildPingMessage = (info: PingResult): string => {
  const tokenHint = info.tokenPresent ? " Token detected." : " Token not detected.";
  return `Connected (Host ${info.hostVersion ?? "unknown"}).${tokenHint}`;
};

const renderError = (err: MappedError): string =>
  err.hint ? `${err.message} ${err.hint}` : err.message;

export const useSigningStore = (): UseSigningStore => {
  const [dscStatus, setDscStatus] = useState<DscStatus | null>(null);
  const [rawCerts, setRawCerts] = useState<CertInfo[]>([]);
  const [selectedDsc, setSelectedDsc] = useState<SelectedDsc | null>(null);
  const [dscPin, setDscPin] = useState("");
  const [dscError, setDscError] = useState<string | null>(null);
  const [dscLoading, setDscLoading] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isPingingConnector, setIsPingingConnector] = useState(false);
  const [connectorPingMessage, setConnectorPingMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<SigningProgress | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      cancelAllPending("Signing component unmounted.");
    };
  }, []);

  /**
   * Group the flat `CertInfo[]` by slot and surface the legacy
   * `{ slotIndex, certIndex, cn, label }` shape the dropdown expects.
   */
  const dscCertificates = useMemo<LegacyDscCertificate[]>(() => {
    const perSlotCount = new Map<number, number>();
    return rawCerts.map((cert) => {
      const certIndex = perSlotCount.get(cert.slotId) ?? 0;
      perSlotCount.set(cert.slotId, certIndex + 1);
      return {
        slotIndex: cert.slotId,
        certIndex,
        cn: extractCn(cert),
        label: cert.label,
      };
    });
  }, [rawCerts]);

  /** Resolve the current `selectedDsc` back to the native `(slotId, certId)`. */
  const resolveNativeSelection = useCallback(
    (sel: SelectedDsc | null): { slotId: number; certId: string } | null => {
      if (!sel) return null;
      const slotCerts = rawCerts.filter((c) => c.slotId === sel.slotIndex);
      const cert = slotCerts[sel.certIndex];
      if (!cert) return null;
      return { slotId: cert.slotId, certId: cert.id };
    },
    [rawCerts]
  );

  const cancelPending = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    cancelAllPending("Bridge request cancelled.");
  }, []);

  const reset = useCallback(() => {
    cancelPending();
    setDscStatus(null);
    setRawCerts([]);
    setSelectedDsc(null);
    setDscPin("");
    setDscError(null);
    setDscLoading(false);
    setIsSigning(false);
    setIsPingingConnector(false);
    setConnectorPingMessage(null);
    setProgress(null);
  }, [cancelPending]);

  const initialize = useCallback(async () => {
    setDscError(null);
    setDscLoading(true);
    setSelectedDsc(null);

    if (!isExtensionAvailable()) {
      const mapped = mappedErrorForCode("NO_EXTENSION");
      setDscStatus({ connected: false, message: "Connector unavailable" });
      setRawCerts([]);
      setDscError(renderError(mapped));
      setDscLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    try {
      const ping = await pingHost(signal);
      setDscStatus({ connected: true, message: buildPingMessage(ping) });

      const certs = await listAllCerts(signal);
      setRawCerts(certs);
      if (certs.length === 0) {
        setDscError("No DSC certificates were returned by the connector.");
      }
    } catch (error) {
      const mapped = mapBridgeError(error);
      console.error("Failed to load connector info:", error);
      setDscStatus({ connected: false, message: "Connector unavailable" });
      setRawCerts([]);
      setDscError(renderError(mapped));
    } finally {
      setDscLoading(false);
    }
  }, []);

  const checkConnectorHealth = useCallback(async () => {
    setIsPingingConnector(true);
    setConnectorPingMessage(null);

    if (!isExtensionAvailable()) {
      const mapped = mappedErrorForCode("NO_EXTENSION");
      setDscStatus({ connected: false, message: "Connector unavailable" });
      setConnectorPingMessage(renderError(mapped));
      setIsPingingConnector(false);
      return;
    }

    try {
      const ping = await pingHost();
      const message = buildPingMessage(ping);
      setDscStatus({ connected: true, message });
      setConnectorPingMessage(
        ping.tokenPresent
          ? "Connector is reachable. Token detected."
          : "Connector is reachable. Token not detected."
      );
    } catch (error) {
      const mapped = mapBridgeError(error);
      setDscStatus({ connected: false, message: "Connector unavailable" });
      setConnectorPingMessage(renderError(mapped));
    } finally {
      setIsPingingConnector(false);
    }
  }, []);

  const signCurrentPdf = useCallback(
    async (blob: Blob, fileName?: string): Promise<SignPdfFinalResult | null> => {
      const native = resolveNativeSelection(selectedDsc);
      if (!native) {
        const mapped = mappedErrorForCode("NO_CERT_SELECTED");
        setDscError(renderError(mapped));
        return null;
      }

      if (!isExtensionAvailable()) {
        const mapped = mappedErrorForCode("NO_EXTENSION");
        setDscError(renderError(mapped));
        return null;
      }

      setIsSigning(true);
      setDscError(null);
      setProgress({ sent: 0, total: 0 });

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      try {
        const pdfBase64 = await blobToBase64(blob);
        const result = await signPdf({
          pdfBase64,
          slotId: native.slotId,
          certId: native.certId,
          fileName,
          contentType: blob.type || "application/pdf",
          pinHint: dscPin || undefined,
          signal,
          onProgress: (sent, total) => setProgress({ sent, total }),
        });
        setProgress({ sent: 1, total: 1 });
        return result;
      } catch (error) {
        const mapped = mapBridgeError(error);
        console.error("Error signing PDF:", error);
        setDscError(renderError(mapped));
        if (
          mapped.code === "PIN_CANCELLED" ||
          mapped.code === "PIN_INCORRECT" ||
          mapped.code === "PIN_LOCKED"
        ) {
          setDscPin("");
        }
        return null;
      } finally {
        setIsSigning(false);
      }
    },
    [dscPin, resolveNativeSelection, selectedDsc]
  );

  return {
    dscStatus,
    dscCertificates,
    selectedDsc,
    dscPin,
    dscError,
    dscLoading,
    isSigning,
    isPingingConnector,
    connectorPingMessage,
    progress,
    setSelectedDsc,
    setDscPin,
    setDscError,
    initialize,
    checkConnectorHealth,
    signCurrentPdf,
    cancelPending,
    reset,
  };
};
