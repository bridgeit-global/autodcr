"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

/**
 * In-process application-details sidebar slot.
 * `mode: "approve"` — Approved button (manual stage transition after signatures).
 * Legacy / omitted mode behaves like approve for the sidebar label after this change.
 */
export type ApplicationSignSlot = {
  /** Sidebar shows Approved (default). Reserved if a future sign mode is needed. */
  mode?: "approve" | "sign";
  onSign: () => Promise<void>;
  disabled: boolean;
  busy: boolean;
  subtitle?: string;
  /**
   * When `false`, the current user cannot act — sidebar shows a muted disabled control.
   * Omit or `true` when the action is allowed.
   */
  actionAvailable?: boolean;
  /** Short hint shown when `actionAvailable === false` (e.g. “Waiting for both signatures…”). */
  unavailableHint?: string;
  /** Progress line while signing/approving. */
  statusText?: string;
  /** Button label when not busy (default: Approved). */
  actionLabel?: string;
  /** Busy label (default: Approving…). */
  busyLabel?: string;
} | null;

type ApplicationSignSlotContextValue = {
  slot: ApplicationSignSlot;
  setSlot: Dispatch<SetStateAction<ApplicationSignSlot>>;
};

const ApplicationSignSlotContext = createContext<ApplicationSignSlotContextValue | undefined>(
  undefined
);

export function ApplicationSignSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ApplicationSignSlot>(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return (
    <ApplicationSignSlotContext.Provider value={value}>{children}</ApplicationSignSlotContext.Provider>
  );
}

export function useApplicationSignSlot(): ApplicationSignSlotContextValue {
  const ctx = useContext(ApplicationSignSlotContext);
  if (!ctx) {
    throw new Error("useApplicationSignSlot must be used within ApplicationSignSlotProvider");
  }
  return ctx;
}

export function useApplicationSignSlotOptional(): ApplicationSignSlotContextValue | null {
  return useContext(ApplicationSignSlotContext) ?? null;
}
