const normalizeBaseUrl = (value: string | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

export const isRemoteDSCEnabled = (): boolean => {
  return Boolean(normalizeBaseUrl(process.env.DSC_SERVICE_URL));
};

const getRemoteBaseUrl = (): string => {
  const baseUrl = normalizeBaseUrl(process.env.DSC_SERVICE_URL);
  if (!baseUrl) {
    throw new Error("DSC_SERVICE_URL is not configured");
  }
  return baseUrl;
};

const getRemoteHeaders = (): HeadersInit => {
  const headers: HeadersInit = {};
  if (process.env.DSC_SERVICE_API_KEY) {
    headers["x-api-key"] = process.env.DSC_SERVICE_API_KEY;
  }
  return headers;
};

export const remoteDscGet = async (path: string): Promise<Response> => {
  const url = `${getRemoteBaseUrl()}${path}`;
  return fetch(url, {
    method: "GET",
    headers: getRemoteHeaders(),
    cache: "no-store",
  });
};

export const remoteDscPostFormData = async (
  path: string,
  formData: FormData
): Promise<Response> => {
  const url = `${getRemoteBaseUrl()}${path}`;
  return fetch(url, {
    method: "POST",
    headers: getRemoteHeaders(),
    body: formData,
    cache: "no-store",
  });
};
