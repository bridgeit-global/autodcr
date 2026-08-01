"use client";

import type { ReactNode } from "react";
import {
  detectDscSignerOs,
  getDscChromeStoreUrl,
  getDscExtensionZipUrl,
  getDscNativeHostDownloads,
  getDscTokenDriverUrl,
  getPreferredNativeHostDownload,
  hasAnyDscSignerDownloadConfigured,
  type DscSignerOs,
} from "@/app/utils/dscSignerDownloads";

type DscSignerInstallModalProps = {
  open: boolean;
  onClose: () => void;
};

function DownloadButton({
  href,
  children,
  disabled,
}: {
  href: string | null;
  children: ReactNode;
  disabled?: boolean;
}) {
  const isDisabled = disabled || !href;
  if (isDisabled) {
    return (
      <button
        type="button"
        disabled
        className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
      >
        {children}
      </button>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full text-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-800 to-emerald-500 hover:from-emerald-900 hover:to-emerald-600 text-white shadow-sm hover:shadow-md transition-all"
    >
      {children}
    </a>
  );
}

function osLabel(os: DscSignerOs): string {
  if (os === "mac") return "macOS";
  if (os === "win") return "Windows";
  if (os === "linux") return "Linux";
  return "your OS";
}

export default function DscSignerInstallModal({
  open,
  onClose,
}: DscSignerInstallModalProps) {
  if (!open) return null;

  const detectedOs = detectDscSignerOs();
  const extensionZipUrl = getDscExtensionZipUrl();
  const chromeStoreUrl = getDscChromeStoreUrl();
  const tokenDriverUrl = getDscTokenDriverUrl();
  const preferredHost = getPreferredNativeHostDownload(detectedOs);
  const allHosts = getDscNativeHostDownloads();
  const configured = hasAnyDscSignerDownloadConfigured();
  const otherHosts = allHosts.filter(
    (d) => d.os !== preferredHost?.os && Boolean(d.url)
  );

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dsc-signer-install-title"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="dsc-signer-install-title"
              className="text-lg font-semibold text-gray-900"
            >
              Install DSC Signer
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Download the Chrome extension, native host, and DSC token driver so
              you can sign from this app.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {!configured ? (
          <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Download links are not configured yet. Ask your administrator to set
            the DSC signer download URLs.
          </p>
        ) : null}

        <div className="mt-5 space-y-5">
          <section>
            <h3 className="text-sm font-semibold text-gray-900">
              1. Chrome extension
            </h3>
            {chromeStoreUrl ? (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-gray-500">
                  Install from the Chrome Web Store (recommended).
                </p>
                <DownloadButton href={chromeStoreUrl}>
                  Open Chrome Web Store
                </DownloadButton>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-gray-500">
                  Download the zip, unzip it, then load the folder in Chrome.
                </p>
                <DownloadButton href={extensionZipUrl}>
                  Download extension.zip
                </DownloadButton>
                {!extensionZipUrl ? (
                  <p className="text-xs text-gray-400">
                    Extension download URL not configured.
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900">
              2. Native host ({osLabel(detectedOs)})
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Install the helper that talks to your DSC USB token, then restart
              Chrome.
            </p>
            <div className="mt-2 space-y-2">
              {preferredHost ? (
                <DownloadButton href={preferredHost.url}>
                  Download {preferredHost.label} installer ({preferredHost.fileHint})
                </DownloadButton>
              ) : (
                <p className="text-xs text-gray-400">
                  Could not detect your OS — use a link below if available.
                </p>
              )}
              {preferredHost && !preferredHost.url ? (
                <p className="text-xs text-gray-400">
                  {preferredHost.label} installer URL not configured.
                </p>
              ) : null}
              {otherHosts.length > 0 ? (
                <div className="pt-1 space-y-1.5">
                  <p className="text-xs text-gray-500">Other platforms:</p>
                  {otherHosts.map((d) => (
                    <a
                      key={d.os}
                      href={d.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
                    >
                      {d.label} ({d.fileHint})
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900">
              3. DSC token driver (HyperPKI / HYP2003)
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Required if signing fails with “no PKCS#11 module”. Download the
              middleware for your OS (macOS / Windows / Linux) from the vendor
              page, install it, then restart Chrome.
            </p>
            <div className="mt-2 space-y-2">
              <DownloadButton href={tokenDriverUrl}>
                Download DSC token driver
              </DownloadButton>
              <p className="text-xs text-gray-400">
                Opens{" "}
                <span className="font-mono break-all">
                  support.winlinetech.com
                </span>
                . Pick your OS under HyperPKI HYP2003.
              </p>
            </div>
          </section>

          <section className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Install steps</h3>
            <ol className="mt-2 list-decimal list-inside space-y-1.5 text-sm text-gray-600">
              {chromeStoreUrl ? (
                <li>Open the Chrome Web Store link and add the extension.</li>
              ) : (
                <li>
                  Unzip <span className="font-medium">extension.zip</span>. In
                  Chrome open{" "}
                  <span className="font-mono text-xs">chrome://extensions</span>
                  , enable <span className="font-medium">Developer mode</span>,
                  click <span className="font-medium">Load unpacked</span>, and
                  select the unzipped folder.
                </li>
              )}
              <li>
                Run the native host installer for your OS, then fully quit and
                reopen Chrome.
              </li>
              <li>
                If you have not installed the DSC vendor middleware yet, open
                the token driver page, download for your OS, install, then quit
                and reopen Chrome.
              </li>
              <li>Return here, plug in your DSC token, and try Sign again.</li>
            </ol>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
