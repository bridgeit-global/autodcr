/**
 * Download URLs for the AutoDCR DSC Chrome extension and native-host installers.
 * Configure via NEXT_PUBLIC_DSC_* env vars (typically GitHub Release or CDN links).
 */

export type DscSignerOs = "mac" | "win" | "linux" | "unknown";

export type DscNativeHostDownload = {
  os: DscSignerOs;
  label: string;
  url: string | null;
  fileHint: string;
};

function trimUrl(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export function getDscExtensionZipUrl(): string | null {
  return trimUrl(process.env.NEXT_PUBLIC_DSC_EXTENSION_ZIP_URL);
}

export function getDscChromeStoreUrl(): string | null {
  return trimUrl(process.env.NEXT_PUBLIC_DSC_CHROME_STORE_URL);
}

/**
 * Vendor PKCS#11 / token middleware download page (e.g. HyperPKI HYP2003).
 * Defaults to the Winline HYP2003 driver page; override via env if needed.
 */
export function getDscTokenDriverUrl(): string | null {
  return (
    trimUrl(process.env.NEXT_PUBLIC_DSC_TOKEN_DRIVER_URL) ??
    "https://www.support.winlinetech.com/knowledgebase.php?article=1"
  );
}

export function getDscNativeHostDownloads(): DscNativeHostDownload[] {
  return [
    {
      os: "mac",
      label: "macOS",
      url: trimUrl(process.env.NEXT_PUBLIC_DSC_NATIVE_HOST_MAC_URL),
      fileHint: ".pkg",
    },
    {
      os: "win",
      label: "Windows",
      url: trimUrl(process.env.NEXT_PUBLIC_DSC_NATIVE_HOST_WIN_URL),
      fileHint: ".msi",
    },
    {
      os: "linux",
      label: "Linux",
      url: trimUrl(process.env.NEXT_PUBLIC_DSC_NATIVE_HOST_LINUX_URL),
      fileHint: ".deb",
    },
  ];
}

export function detectDscSignerOs(): DscSignerOs {
  if (typeof navigator === "undefined") return "unknown";

  const uaData = (
    navigator as Navigator & {
      userAgentData?: { platform?: string };
    }
  ).userAgentData;
  const platform = (uaData?.platform || navigator.platform || "").toLowerCase();
  const ua = (navigator.userAgent || "").toLowerCase();

  if (platform.includes("mac") || ua.includes("mac os")) return "mac";
  if (platform.includes("win") || ua.includes("windows")) return "win";
  if (
    platform.includes("linux") ||
    platform.includes("cros") ||
    ua.includes("linux")
  ) {
    return "linux";
  }
  return "unknown";
}

/** Preferred native-host download for the current OS; null if URL not configured. */
export function getPreferredNativeHostDownload(
  os: DscSignerOs = detectDscSignerOs()
): DscNativeHostDownload | null {
  const all = getDscNativeHostDownloads();
  if (os === "unknown") return null;
  return all.find((d) => d.os === os) ?? null;
}

export function hasAnyDscSignerDownloadConfigured(): boolean {
  if (getDscExtensionZipUrl() || getDscChromeStoreUrl()) return true;
  if (getDscTokenDriverUrl()) return true;
  return getDscNativeHostDownloads().some((d) => Boolean(d.url));
}
