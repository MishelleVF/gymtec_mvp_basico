// src/services/api.ts
// Thin fetch wrapper. All HTTP details live here; gymtecApi.ts composes them.

function resolveBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;

  // Default to the same host where the frontend is opened, but backend port 8000.
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000`;
  }

  return "http://localhost:8000";
}

const BASE_URL = resolveBaseUrl();

const DEFAULT_TIMEOUT_MS = 8000;
const GOOGLE_TIMEOUT_MS = 20000; // Google OAuth can be slower

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new ApiError(`Request timed out after ${ms}ms`)),
      ms
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export async function apiGet<T>(
  path: string,
  opts: { timeoutMs?: number } = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await withTimeout(
      fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }),
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      `No se pudo conectar al backend (${BASE_URL}). Verifica que la API esté levantada en puerto 8000.`
    );
  }
  if (!res.ok) {
    let detail = `GET ${path} failed`;
    try {
      const body = await res.json();
      detail = body?.detail ?? body?.message ?? detail;
    } catch {}
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

export async function apiPost<TReq, TRes>(
  path: string,
  body: TReq,
  opts: { timeoutMs?: number } = {}
): Promise<TRes> {
  const url = `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      }),
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      `No se pudo conectar al backend (${BASE_URL}). Verifica que la API esté levantada en puerto 8000.`
    );
  }
  if (!res.ok) {
    let detail = `POST ${path} failed`;
    try {
      const body = await res.json();
      detail = body?.detail ?? body?.message ?? detail;
    } catch {}
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as TRes;
}

/**
 * Google Calendar API calls with extended timeout (20s).
 * OAuth operations can be slower than regular API calls.
 */
export async function apiGetGoogle<T>(
  path: string,
  opts: { timeoutMs?: number } = {}
): Promise<T> {
  return apiGet<T>(path, { timeoutMs: opts.timeoutMs ?? GOOGLE_TIMEOUT_MS });
}

export async function apiPostGoogle<TReq, TRes>(
  path: string,
  body: TReq,
  opts: { timeoutMs?: number } = {}
): Promise<TRes> {
  return apiPost<TReq, TRes>(path, body, {
    timeoutMs: opts.timeoutMs ?? GOOGLE_TIMEOUT_MS,
  });
}

export const apiBaseUrl = BASE_URL;
