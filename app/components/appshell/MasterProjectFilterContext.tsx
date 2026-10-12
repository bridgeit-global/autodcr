"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "masterProjectId";

type MasterProjectFilterContextValue = {
  /** Empty string means All projects. */
  masterProjectId: string;
  setMasterProjectId: (projectId: string) => void;
};

const MasterProjectFilterContext = createContext<MasterProjectFilterContextValue | null>(
  null
);

function readStoredProjectId() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function MasterProjectFilterProvider({ children }: { children: ReactNode }) {
  const [masterProjectId, setMasterProjectIdState] = useState("");

  useEffect(() => {
    setMasterProjectIdState(readStoredProjectId());
  }, []);

  const setMasterProjectId = useCallback((projectId: string) => {
    const next = projectId.trim();
    setMasterProjectIdState(next);
    try {
      if (next) window.sessionStorage.setItem(STORAGE_KEY, next);
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ masterProjectId, setMasterProjectId }),
    [masterProjectId, setMasterProjectId]
  );

  return (
    <MasterProjectFilterContext.Provider value={value}>
      {children}
    </MasterProjectFilterContext.Provider>
  );
}

export function useMasterProjectFilter() {
  const context = useContext(MasterProjectFilterContext);
  if (!context) {
    throw new Error("useMasterProjectFilter must be used within MasterProjectFilterProvider");
  }
  return context;
}
