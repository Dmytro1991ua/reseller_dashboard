/**
 * Server-side FlashProxy API client.
 * Pass the reseller's API key (from iron-session) as the first argument.
 * Call only from Server Components, Route Handlers, or Server Actions.
 */

import { apiConfig } from "@/lib/apiConfig";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  idempotencyKey?: string;
  searchParams?: Record<string, string | number | boolean | undefined>;
  revalidate?: number | false;
}

export async function flashproxyFetch<T>(
  apiKey: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, idempotencyKey, searchParams, revalidate } = options;

  const url = new URL(`${apiConfig.baseUrl}${path}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;

  const res = await fetch(url.toString(), {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    next:
      revalidate === false
        ? { revalidate: 0 }
        : revalidate !== undefined
          ? { revalidate }
          : { revalidate: 60 },
  });

  const json = await res.json();

  if (!res.ok || json.success === false) {
    const err = json?.error;
    throw Object.assign(new Error(err?.message ?? `HTTP ${res.status}`), {
      code: err?.code ?? "UNKNOWN",
      status: res.status,
      details: err?.details,
    });
  }

  return json.data as T;
}
