// src/services/api.ts
// Thin fetch wrapper. All HTTP details live here; gymtecApi.ts composes them.

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

const DEFAULT_TIMEOUT_MS = 4000;

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
  const res = await withTimeout(
    fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    }),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  if (!res.ok) throw new ApiError(`GET ${path} failed`, res.status);
  return (await res.json()) as T;
}

export async function apiPost<TReq, TRes>(
  path: string,
  body: TReq,
  opts: { timeoutMs?: number } = {}
): Promise<TRes> {
  const url = `${BASE_URL}${path}`;
  const res = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  if (!res.ok) throw new ApiError(`POST ${path} failed`, res.status);
  return (await res.json()) as TRes;
}

export const apiBaseUrl = BASE_URL;
