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

/** Active Create/Edit Project section Save — rendered in ProjectWizardToolbar. */
export type SectionSaveSlot = {
  onSave: () => void | Promise<void>;
  label: "Save section" | "Section saved" | string;
  saved: boolean;
  disabled?: boolean;
} | null;

type SectionSaveSlotContextValue = {
  slot: SectionSaveSlot;
  setSlot: Dispatch<SetStateAction<SectionSaveSlot>>;
};

const SectionSaveSlotContext = createContext<SectionSaveSlotContextValue | undefined>(
  undefined
);

export function SectionSaveSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<SectionSaveSlot>(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return (
    <SectionSaveSlotContext.Provider value={value}>
      {children}
    </SectionSaveSlotContext.Provider>
  );
}

export function useSectionSaveSlot(): SectionSaveSlotContextValue {
  const ctx = useContext(SectionSaveSlotContext);
  if (!ctx) {
    throw new Error("useSectionSaveSlot must be used within SectionSaveSlotProvider");
  }
  return ctx;
}

/** Safe for optional use outside provider. */
export function useSectionSaveSlotOptional(): SectionSaveSlotContextValue | null {
  return useContext(SectionSaveSlotContext) ?? null;
}
