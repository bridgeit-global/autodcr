"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type DashboardAlertOptions = {
  title: string;
  message: string;
};

type DashboardAlertModalContextValue = {
  showAlert: (options: DashboardAlertOptions) => void;
};

const DashboardAlertModalContext =
  createContext<DashboardAlertModalContextValue | null>(null);

export function DashboardAlertModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<DashboardAlertOptions | null>(null);

  const showAlert = useCallback((next: DashboardAlertOptions) => {
    setOptions(next);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    setOptions(null);
  }, []);

  return (
    <DashboardAlertModalContext.Provider value={{ showAlert }}>
      {children}
      {open && options && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dashboard-alert-title"
          aria-describedby="dashboard-alert-desc"
        >
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3
              id="dashboard-alert-title"
              className="text-lg font-semibold text-gray-900 mb-2"
            >
              {options.title}
            </h3>
            <p
              id="dashboard-alert-desc"
              className="text-sm text-gray-600 mb-6 whitespace-pre-line"
            >
              {options.message}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={hide}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardAlertModalContext.Provider>
  );
}

export function useDashboardAlertModal() {
  const ctx = useContext(DashboardAlertModalContext);
  if (!ctx) {
    throw new Error(
      "useDashboardAlertModal must be used within DashboardAlertModalProvider"
    );
  }
  return ctx;
}
