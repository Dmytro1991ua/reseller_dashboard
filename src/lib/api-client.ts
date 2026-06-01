/**
 * Server-side FlashProxy API client.
 * The API key lives only in FLASHPROXY_API_KEY (no NEXT_PUBLIC_ prefix).
 * Call this from Server Components, Route Handlers, or Server Actions only.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function getKey(): string {
  const key = process.env.FLASHPROXY_API_KEY;
  if (!key) throw new Error("FLASHPROXY_API_KEY is not set");
  return key;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  idempotencyKey?: string;
  searchParams?: Record<string, string | number | boolean | undefined>;
  revalidate?: number | false;
}

export async function flashproxyFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    idempotencyKey,
    searchParams,
    revalidate,
  } = options;

  const url = new URL(`${BASE_URL}${path}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${getKey()}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;

  const fetchOptions: RequestInit = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    next:
      revalidate === false
        ? { revalidate: 0 }
        : revalidate !== undefined
          ? { revalidate }
          : { revalidate: 60 },
  };

  const res = await fetch(url.toString(), fetchOptions);
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
