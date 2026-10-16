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
const AUTHORITY_STORAGE_KEY = "masterPlanningAuthority";

type MasterProjectFilterContextValue = {
  /** Empty string means All projects. */
  masterProjectId: string;
  setMasterProjectId: (projectId: string) => void;
  /** Empty string means All authorities. */
  masterAuthority: string;
  setMasterAuthority: (authority: string) => void;
};

const MasterProjectFilterContext = createContext<MasterProjectFilterContextValue | null>(
  null
);

function readStoredValue(key: string) {
  try {
    return window.sessionStorage.getItem(key)?.trim() || "";
  } catch {
    return "";
  }
}

function writeStoredValue(key: string, value: string) {
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function MasterProjectFilterProvider({ children }: { children: ReactNode }) {
  const [masterProjectId, setMasterProjectIdState] = useState("");
  const [masterAuthority, setMasterAuthorityState] = useState("");

  useEffect(() => {
    setMasterProjectIdState(readStoredValue(STORAGE_KEY));
    setMasterAuthorityState(readStoredValue(AUTHORITY_STORAGE_KEY));
  }, []);

  const setMasterProjectId = useCallback((projectId: string) => {
    const next = projectId.trim();
    setMasterProjectIdState(next);
    writeStoredValue(STORAGE_KEY, next);
  }, []);

  const setMasterAuthority = useCallback((authority: string) => {
    const next = authority.trim();
    setMasterAuthorityState(next);
    writeStoredValue(AUTHORITY_STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ masterProjectId, setMasterProjectId, masterAuthority, setMasterAuthority }),
    [masterProjectId, setMasterProjectId, masterAuthority, setMasterAuthority]
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
