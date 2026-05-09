/**
 * Stepwise DSC bridge state: PING → LIST_SLOTS → LIST_CERTS(slot) → SIGN_PDF_*.
 * Used by BridgeSignModal only; signingStore remains for template/page.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cancelAllPending, isExtensionAvailable } from "./bridgeClient";
import { mapBridgeError, mappedErrorForCode, MappedError } from "./errorMapper";
import { blobToBase64 } from "./pdfChunker";
import {
  assertPdfHasSigningMarkers,
  DscStampSpec,
  preparePdfForNativeSigning,
} from "./pdfSigningPrep";
import { CertInfo, PingResult, SignPdfFinalResult, SlotInfo } from "./protocol";
import { listCertsForSlot, listSlots, pingHost, signPdf } from "./signingOrchestrator";

export interface DscStatus {
  connected: boolean;
  message: string;
}

export interface SigningProgress {
  sent: number;
  total: number;
}

const buildPingMessage = (info: PingResult): string => {
  const tokenHint = info.tokenPresent ? " Token detected." : " Token not detected.";
  return `Connected (Host ${info.hostVersion ?? "unknown"}).${tokenHint}`;
};

const renderError = (err: MappedError): string =>
  err.hint ? `${err.message} ${err.hint}` : err.message;

/**
 * Resolves the id sent in LIST_CERTS({ slotId }), matching bridge-poc
 * `getSlotIdForSigning`: host may use slotId, id, slot, slotID, string numbers,
 * or omit id entirely (then use list index).
 */
const resolveSlotIdForListCerts = (
  slot: SlotInfo | Record<string, unknown>,
  fallbackSlotIndex?: number
): number | null => {
  if (!slot || typeof slot !== "object") return null;
  const candidate = slot as SlotInfo & {
    id?: unknown;
    slot?: unknown;
    slotID?: unknown;
  };
  const rawValue: unknown =
    candidate.slotId ?? candidate.id ?? candidate.slot ?? candidate.slotID;
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue;
  if (typeof rawValue === "string" && rawValue.trim() && !Number.isNaN(Number(rawValue))) {
    return Number(rawValue);
  }
  if (
    fallbackSlotIndex !== undefined &&
    Number.isInteger(fallbackSlotIndex) &&
    fallbackSlotIndex >= 0
  ) {
    return fallbackSlotIndex;
  }
  return null;
};

/** Normalize LIST_SLOTS rows so each entry has a finite numeric `slotId` for the wire API. */
const normalizeSlotsFromHost = (rawSlots: SlotInfo[]): SlotInfo[] => {
  const out: SlotInfo[] = [];
  rawSlots.forEach((s, index) => {
    const slotId = resolveSlotIdForListCerts(s, index);
    if (slotId === null) return;
    out.push({ ...s, slotId });
  });
  return out;
};

export interface SignCurrentPdfOptions {
  fileName?: string;
  stamp?: DscStampSpec;
}

export interface UseStepwiseSigning {
  dscStatus: DscStatus | null;
  slots: SlotInfo[];
  selectedSlotId: number | null;
  certsForSelectedSlot: CertInfo[];
  selectedCertId: string;
  pin: string;
  error: string | null;
  isLoadingSlots: boolean;
  isLoadingCerts: boolean;
  isSigning: boolean;
  isPingingConnector: boolean;
  connectorPingMessage: string | null;
  progress: SigningProgress | null;

  setSelectedSlotId: (slotId: number | null) => void;
  setSelectedCertId: (certId: string) => void;
  setPin: (pin: string) => void;
  setError: (msg: string | null) => void;

  initialize: () => Promise<void>;
  reloadSlotsAndCerts: () => Promise<void>;
  checkConnectorHealth: () => Promise<void>;
  signCurrentPdf: (
    blob: Blob,
    opts?: SignCurrentPdfOptions
  ) => Promise<SignPdfFinalResult | null>;

  cancelPending: () => void;
  reset: () => void;
}

export const useStepwiseSigning = (): UseStepwiseSigning => {
  const [dscStatus, setDscStatus] = useState<DscStatus | null>(null);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [selectedSlotId, setSelectedSlotIdState] = useState<number | null>(null);
  const [certsBySlot, setCertsBySlot] = useState<Record<number, CertInfo[]>>({});
  const [selectedCertId, setSelectedCertIdState] = useState("");
  const [pin, setPinState] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isLoadingCerts, setIsLoadingCerts] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isPingingConnector, setIsPingingConnector] = useState(false);
  const [connectorPingMessage, setConnectorPingMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<SigningProgress | null>(null);

  const initAbortRef = useRef<AbortController | null>(null);
  const certAbortRef = useRef<AbortController | null>(null);
  const signAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      initAbortRef.current?.abort();
      certAbortRef.current?.abort();
      signAbortRef.current?.abort();
      cancelAllPending("Signing component unmounted.");
    };
  }, []);

  const certsForSelectedSlot =
    selectedSlotId === null ? [] : (certsBySlot[selectedSlotId] ?? []);

  const cancelPending = useCallback(() => {
    initAbortRef.current?.abort();
    initAbortRef.current = null;
    certAbortRef.current?.abort();
    certAbortRef.current = null;
    signAbortRef.current?.abort();
    signAbortRef.current = null;
    cancelAllPending("Bridge request cancelled.");
  }, []);

  const reset = useCallback(() => {
    cancelPending();
    setDscStatus(null);
    setSlots([]);
    setSelectedSlotIdState(null);
    setCertsBySlot({});
    setSelectedCertIdState("");
    setPinState("");
    setError(null);
    setIsLoadingSlots(false);
    setIsLoadingCerts(false);
    setIsSigning(false);
    setIsPingingConnector(false);
    setConnectorPingMessage(null);
    setProgress(null);
  }, [cancelPending]);

  const loadCertsForSlot = useCallback(
    async (slotId: number, signal: AbortSignal): Promise<CertInfo[]> => {
      setIsLoadingCerts(true);
      try {
        const certs = await listCertsForSlot(slotId, signal);
        if (signal.aborted) return [];
        setCertsBySlot((prev) => ({ ...prev, [slotId]: certs }));
        return certs;
      } finally {
        if (!signal.aborted) setIsLoadingCerts(false);
      }
    },
    []
  );

  const initialize = useCallback(async () => {
    setError(null);
    setIsLoadingSlots(true);
    setSelectedSlotIdState(null);
    setSelectedCertIdState("");
    setCertsBySlot({});

    if (!isExtensionAvailable()) {
      const mapped = mappedErrorForCode("NO_EXTENSION");
      setDscStatus({ connected: false, message: "Connector unavailable" });
      setSlots([]);
      setError(renderError(mapped));
      setIsLoadingSlots(false);
      return;
    }

    initAbortRef.current?.abort();
    initAbortRef.current = new AbortController();
    const { signal } = initAbortRef.current;

    try {
      const ping = await pingHost(signal);
      if (signal.aborted) return;
      setDscStatus({ connected: true, message: buildPingMessage(ping) });

      const rawSlots = await listSlots(signal);
      if (signal.aborted) return;
      const usable = normalizeSlotsFromHost(rawSlots);
      setSlots(usable);

      if (usable.length === 0) {
        setError(
          rawSlots.length > 0
            ? "Connector returned slots but none could be mapped to a slot id. Try Reload or update the native host."
            : "No DSC slots were returned by the connector."
        );
        return;
      }

      if (usable.length === 1) {
        const only = usable[0].slotId;
        setSelectedSlotIdState(only);
        const certs = await loadCertsForSlot(only, signal);
        if (!signal.aborted && certs.length > 0) {
          setSelectedCertIdState(certs[0].id);
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      const mapped = mapBridgeError(err);
      console.error("Failed to load connector info:", err);
      setDscStatus({ connected: false, message: "Connector unavailable" });
      setSlots([]);
      setError(renderError(mapped));
    } finally {
      if (!signal.aborted) setIsLoadingSlots(false);
    }
  }, [loadCertsForSlot]);

  const setSelectedSlotId = useCallback(
    (slotId: number | null) => {
      setSelectedCertIdState("");
      setSelectedSlotIdState(slotId);
      if (slotId === null) return;

      certAbortRef.current?.abort();
      certAbortRef.current = new AbortController();
      const { signal } = certAbortRef.current;

      void (async () => {
        try {
          const cached = certsBySlot[slotId];
          if (cached && cached.length > 0) {
            setSelectedCertIdState(cached[0].id);
            return;
          }
          const certs = await loadCertsForSlot(slotId, signal);
          if (signal.aborted) return;
          if (certs.length > 0) {
            setSelectedCertIdState(certs[0].id);
          }
        } catch (e) {
          if (signal.aborted) return;
          const mapped = mapBridgeError(e);
          setError(renderError(mapped));
        }
      })();
    },
    [certsBySlot, loadCertsForSlot]
  );

  const reloadSlotsAndCerts = useCallback(async () => {
    setError(null);

    if (!isExtensionAvailable()) {
      const mapped = mappedErrorForCode("NO_EXTENSION");
      setDscStatus({ connected: false, message: "Connector unavailable" });
      setError(renderError(mapped));
      return;
    }

    const prevSlot = selectedSlotId;
    const prevCert = selectedCertId;

    initAbortRef.current?.abort();
    initAbortRef.current = new AbortController();
    const { signal } = initAbortRef.current;
    setIsLoadingSlots(true);

    try {
      const ping = await pingHost(signal);
      if (signal.aborted) return;
      setDscStatus({ connected: true, message: buildPingMessage(ping) });

      const rawSlots = await listSlots(signal);
      if (signal.aborted) return;
      const usable = normalizeSlotsFromHost(rawSlots);
      setSlots(usable);

      if (usable.length === 0) {
        setError(
          rawSlots.length > 0
            ? "Connector returned slots but none could be mapped to a slot id. Try Reload or update the native host."
            : "No DSC slots were returned by the connector."
        );
        setSelectedSlotIdState(null);
        setSelectedCertIdState("");
        return;
      }

      let nextSlot: number | null = null;
      if (prevSlot !== null && usable.some((s) => s.slotId === prevSlot)) {
        nextSlot = prevSlot;
      } else if (usable.length === 1) {
        nextSlot = usable[0].slotId;
      }

      setSelectedSlotIdState(nextSlot);
      setSelectedCertIdState("");

      if (nextSlot === null) return;

      const certs = await loadCertsForSlot(nextSlot, signal);
      if (signal.aborted) return;

      const pick =
        prevCert && certs.some((c) => c.id === prevCert) ? prevCert : certs[0]?.id ?? "";
      setSelectedCertIdState(pick);
    } catch (e) {
      if (signal.aborted) return;
      const mapped = mapBridgeError(e);
      console.error("Failed to reload slots:", e);
      setDscStatus({ connected: false, message: "Connector unavailable" });
      setError(renderError(mapped));
    } finally {
      if (!signal.aborted) setIsLoadingSlots(false);
    }
  }, [loadCertsForSlot, selectedCertId, selectedSlotId]);

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
    } catch (e) {
      const mapped = mapBridgeError(e);
      setDscStatus({ connected: false, message: "Connector unavailable" });
      setConnectorPingMessage(renderError(mapped));
    } finally {
      setIsPingingConnector(false);
    }
  }, []);

  const signCurrentPdf = useCallback(
    async (blob: Blob, opts?: SignCurrentPdfOptions): Promise<SignPdfFinalResult | null> => {
      if (selectedSlotId === null || !selectedCertId) {
        const mapped = mappedErrorForCode("NO_CERT_SELECTED");
        setError(renderError(mapped));
        return null;
      }

      if (!isExtensionAvailable()) {
        const mapped = mappedErrorForCode("NO_EXTENSION");
        setError(renderError(mapped));
        return null;
      }

      setIsSigning(true);
      setError(null);
      setProgress({ sent: 0, total: 0 });

      signAbortRef.current?.abort();
      signAbortRef.current = new AbortController();
      const { signal } = signAbortRef.current;

      try {
        // Mirror bridge-poc's `runUploadedPdfSigningFlow`: refresh LIST_CERTS
        // for the selected slot immediately before SIGN_PDF_START so the
        // native host's PKCS#11 session is freshly logged in for the slot
        // we are about to sign on. Without this, hosts that recycle the
        // session between commands return `CMS_BUILD_FAILED` /
        // "0 private-key objects after login" at SIGN_PDF_END even though
        // every chunk was accepted.
        const freshCerts = await listCertsForSlot(selectedSlotId, signal);
        if (signal.aborted) return null;
        setCertsBySlot((prev) => ({ ...prev, [selectedSlotId]: freshCerts }));

        const freshCert = freshCerts.find((c) => c.id === selectedCertId);
        if (!freshCert) {
          const fallback = freshCerts[0]?.id ?? "";
          setSelectedCertIdState(fallback);
          throw new Error(
            "Selected certificate is no longer present in the slot. " +
              "The certificate list has been refreshed — please reselect and retry."
          );
        }

        const buffer = await blob.arrayBuffer();
        const prepared = await preparePdfForNativeSigning(buffer, {
          stamp: opts?.stamp,
        });
        assertPdfHasSigningMarkers(prepared);

        const preparedBlob = new Blob([new Uint8Array(prepared)], {
          type: blob.type || "application/pdf",
        });
        const pdfBase64 = await blobToBase64(preparedBlob);

        const result = await signPdf({
          pdfBase64,
          slotId: selectedSlotId,
          certId: freshCert.id,
          fileName: opts?.fileName,
          contentType: preparedBlob.type || "application/pdf",
          pinHint: pin || undefined,
          certSource: "fresh_slot_lookup",
          signal,
          onProgress: (sent, total) => setProgress({ sent, total }),
        });
        setProgress({ sent: 1, total: 1 });
        return result;
      } catch (e) {
        const mapped = mapBridgeError(e);
        console.error("Error signing PDF:", e);
        setError(renderError(mapped));
        if (mapped.code === "PIN_CANCELLED" || mapped.code === "PIN_INCORRECT") {
          setPinState("");
        }
        return null;
      } finally {
        setIsSigning(false);
      }
    },
    [pin, selectedCertId, selectedSlotId]
  );

  return {
    dscStatus,
    slots,
    selectedSlotId,
    certsForSelectedSlot,
    selectedCertId,
    pin,
    error,
    isLoadingSlots,
    isLoadingCerts,
    isSigning,
    isPingingConnector,
    connectorPingMessage,
    progress,

    setSelectedSlotId,
    setSelectedCertId: setSelectedCertIdState,
    setPin: setPinState,
    setError,

    initialize,
    reloadSlotsAndCerts,
    checkConnectorHealth,
    signCurrentPdf,

    cancelPending,
    reset,
  };
};
