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

/** Draft application-details: save PDF from sidebar instead of modal / header. */
export type ApplicationPdfSaveSlot = {
  onSave: () => Promise<void>;
  disabled: boolean;
  busy: boolean;
  done: boolean;
  subtitle?: string;
  statusText?: string;
} | null;

type ApplicationPdfSaveSlotContextValue = {
  slot: ApplicationPdfSaveSlot;
  setSlot: Dispatch<SetStateAction<ApplicationPdfSaveSlot>>;
};

const ApplicationPdfSaveSlotContext = createContext<
  ApplicationPdfSaveSlotContextValue | undefined
>(undefined);

export function ApplicationPdfSaveSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ApplicationPdfSaveSlot>(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return (
    <ApplicationPdfSaveSlotContext.Provider value={value}>
      {children}
    </ApplicationPdfSaveSlotContext.Provider>
  );
}

export function useApplicationPdfSaveSlot(): ApplicationPdfSaveSlotContextValue {
  const ctx = useContext(ApplicationPdfSaveSlotContext);
  if (!ctx) {
    throw new Error("useApplicationPdfSaveSlot must be used within ApplicationPdfSaveSlotProvider");
  }
  return ctx;
}

/** Safe for optional use outside provider (returns null setter). */
export function useApplicationPdfSaveSlotOptional(): ApplicationPdfSaveSlotContextValue | null {
  return useContext(ApplicationPdfSaveSlotContext) ?? null;
}
