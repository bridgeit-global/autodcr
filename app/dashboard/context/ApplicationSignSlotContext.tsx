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

/** In-process application-details: open preview to sign from sidebar (same pattern as save slot). */
export type ApplicationSignSlot = {
  onSign: () => Promise<void>;
  disabled: boolean;
  busy: boolean;
  subtitle?: string;
  /**
   * When `false`, the current user cannot sign in this workflow step — sidebar shows a muted disabled control.
   * Omit or `true` when signing is allowed (or legacy callers).
   */
  actionAvailable?: boolean;
  /** Short hint shown when `actionAvailable === false` (e.g. “Waiting for architect…”). */
  unavailableHint?: string;
  /** Progress line while signing (e.g. generating PDFs). */
  statusText?: string;
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
