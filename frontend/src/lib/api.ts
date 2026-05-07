"use client";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  error?: {
    code: string;
    details?: unknown;
  };
  timestamp: string;
};

export type PaginatedData<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const API_BASE_PATH = "/api";
const TOKEN_STORAGE_KEY = "pepperone_api_token";

export function getStoredToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

export function setStoredToken(token: string) {
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
}

export function clearStoredToken() {
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | undefined | null>;
};

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(
    normalizedPath.startsWith(API_BASE_PATH)
      ? normalizedPath
      : `${API_BASE_PATH}${normalizedPath}`,
    window.location.origin,
  );

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return `${url.pathname}${url.search}`;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers);

  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path, options.query), {
    ...options,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !payload?.success) {
    const message =
      payload?.message ||
      payload?.error?.code ||
      `Falha na requisicao (${response.status})`;
    throw new Error(message);
  }

  return payload.data;
}

export async function apiFormRequest<T>(path: string, formData: FormData) {
  const token = getStoredToken();
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers,
    body: formData,
    cache: "no-store",
    credentials: "same-origin",
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !payload?.success) {
    const message =
      payload?.message ||
      payload?.error?.code ||
      `Falha na requisicao (${response.status})`;
    throw new Error(message);
  }

  return payload.data;
}

export function listResource<T>(
  path: string,
  query: { page?: number; limit?: number; search?: string; habilitado?: string } = {},
) {
  return apiRequest<PaginatedData<T>>(path, {
    query: {
      page: query.page || 1,
      limit: query.limit || 10,
      search: query.search,
      habilitado: query.habilitado,
    },
  });
}

export function createResource<T>(path: string, data: Record<string, unknown>) {
  return apiRequest<T>(path, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateResource<T>(
  path: string,
  id: string | number,
  data: Record<string, unknown>,
) {
  return apiRequest<T>(`${path}/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteResource(path: string, id: string | number) {
  return apiRequest<null>(`${path}/${id}`, {
    method: "DELETE",
  });
}
