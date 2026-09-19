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

export type ApplicationLifecycleAction = {
  onClick: () => Promise<void>;
  busy: boolean;
};

/** Draft: delete. In process: backToDraft + reject + delete. */
export type ApplicationLifecycleActionsSlot = {
  delete?: ApplicationLifecycleAction;
  reject?: ApplicationLifecycleAction;
  backToDraft?: ApplicationLifecycleAction;
} | null;

type ApplicationLifecycleActionsSlotContextValue = {
  slot: ApplicationLifecycleActionsSlot;
  setSlot: Dispatch<SetStateAction<ApplicationLifecycleActionsSlot>>;
};

const ApplicationLifecycleActionsSlotContext = createContext<
  ApplicationLifecycleActionsSlotContextValue | undefined
>(undefined);

export function ApplicationLifecycleActionsSlotProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<ApplicationLifecycleActionsSlot>(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return (
    <ApplicationLifecycleActionsSlotContext.Provider value={value}>
      {children}
    </ApplicationLifecycleActionsSlotContext.Provider>
  );
}

export function useApplicationLifecycleActionsSlot(): ApplicationLifecycleActionsSlotContextValue {
  const ctx = useContext(ApplicationLifecycleActionsSlotContext);
  if (!ctx) {
    throw new Error(
      "useApplicationLifecycleActionsSlot must be used within ApplicationLifecycleActionsSlotProvider"
    );
  }
  return ctx;
}

export function useApplicationLifecycleActionsSlotOptional(): ApplicationLifecycleActionsSlotContextValue | null {
  return useContext(ApplicationLifecycleActionsSlotContext) ?? null;
}
