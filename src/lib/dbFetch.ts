import { routeRequest } from "@/lib/router";

/**
 * Drop-in replacement for flashproxyFetch() on server components.
 * Calls the local router directly — no HTTP round-trip, no API key needed.
 * Throws on 4xx/5xx so callers can .catch(() => null) just like before.
 */
export async function dbFetch<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const [rawPath, rawQuery = ""] = path.split("?");
  const segments = rawPath.replace(/^\//, "").split("/").filter(Boolean);
  const search = new URLSearchParams(rawQuery);
  const body = opts.body === undefined ? undefined : structuredClone(opts.body);

  const result = await routeRequest({ method, segments, search, body });

  if (result.status >= 400) {
    const err = result.body as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `Request failed with status ${result.status}`);
  }

  const response = result.body as { success?: boolean; data?: unknown };
  if (response.data !== undefined) {
    return response.data as T;
  }
  return result.body as T;
}
