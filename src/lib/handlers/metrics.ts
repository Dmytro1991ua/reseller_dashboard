import { db } from "@/lib/db";
import type { HandlerResult } from "@/lib/router";

// Deterministic seeded PRNG — same planId always produces the same numbers
function seededRng(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  let s = h >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const METRICS_PRODUCTS = new Set([
  "datacenter",
  "shared_isp",
  "ipv6-residential",
  "ipv6-datacenter",
]);

function buckets(hours: number, now: Date) {
  const count = Math.min(60, hours);
  const bucketMinutes = Math.ceil((hours * 60) / count);
  const result: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    result.push(new Date(now.getTime() - i * bucketMinutes * 60 * 1000));
  }
  return { times: result, bucketMinutes };
}

function fmtBucket(d: Date) {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

async function checkPlan(planId: string): Promise<{ ok: boolean; result?: HandlerResult }> {
  const plan = await db.plan.findUnique({ where: { planId } });
  if (!plan) {
    return {
      ok: false,
      result: {
        status: 404,
        body: { success: false, error: { code: "NOT_FOUND", message: "Plan not found" } },
      },
    };
  }
  if (!METRICS_PRODUCTS.has(plan.product)) {
    return {
      ok: false,
      result: {
        status: 400,
        body: {
          success: false,
          error: {
            code: "METRICS_NOT_SUPPORTED",
            message: `Metrics are not available for product "${plan.product}"`,
          },
        },
      },
    };
  }
  return { ok: true };
}

export async function metricsSummary(
  planId: string,
  search: URLSearchParams,
): Promise<HandlerResult> {
  const check = await checkPlan(planId);
  if (!check.ok) return check.result!;

  const hours = Math.min(168, Math.max(1, Number(search.get("hours") ?? 24)));
  const rng = seededRng(planId + hours);

  const totalConnections = Math.floor(rng() * 200 + 20);
  const totalErrors = Math.floor(rng() * 5);
  const totalSuccesses = totalConnections - totalErrors;
  const totalBytes = Math.floor(rng() * 2e9 + 1e8);

  return {
    status: 200,
    body: {
      success: true,
      data: {
        hours,
        total_bytes: totalBytes,
        total_mb: +(totalBytes / 1e6).toFixed(1),
        total_connections: totalConnections,
        total_successes: totalSuccesses,
        total_errors: totalErrors,
        success_rate_pct: +((totalSuccesses / totalConnections) * 100).toFixed(2),
        peak_concurrent: Math.floor(rng() * 8 + 1),
        avg_mbps: +(rng() * 2).toFixed(2),
        peak_mbps: +(rng() * 8 + 1).toFixed(2),
      },
    },
  };
}

export async function metricsThroughput(
  planId: string,
  search: URLSearchParams,
): Promise<HandlerResult> {
  const check = await checkPlan(planId);
  if (!check.ok) return check.result!;

  const hours = Math.min(168, Math.max(1, Number(search.get("hours") ?? 24)));
  const { times, bucketMinutes } = buckets(hours, new Date());
  const rng = seededRng(planId + "throughput");

  const series = times.map((t, i) => ({
    bucket: fmtBucket(t),
    mbps: +(Math.sin(i * 0.4) * 2 + rng() * 4 + 1).toFixed(2),
    rate_cap_mbps: 3000,
  }));

  return {
    status: 200,
    body: { success: true, data: { hours, bucket_minutes: bucketMinutes, series } },
  };
}

export async function metricsLatency(
  planId: string,
  search: URLSearchParams,
): Promise<HandlerResult> {
  const check = await checkPlan(planId);
  if (!check.ok) return check.result!;

  const hours = Math.min(168, Math.max(1, Number(search.get("hours") ?? 24)));
  const { times, bucketMinutes } = buckets(hours, new Date());
  const rng = seededRng(planId + "latency");

  const series = times.map((t) => {
    const p50 = Math.floor(rng() * 200 + 80);
    return {
      bucket: fmtBucket(t),
      p50,
      p95: p50 + Math.floor(rng() * 800 + 200),
      p99: p50 + Math.floor(rng() * 1200 + 600),
    };
  });

  return {
    status: 200,
    body: { success: true, data: { hours, bucket_minutes: bucketMinutes, series } },
  };
}

export async function metricsErrors(
  planId: string,
  search: URLSearchParams,
): Promise<HandlerResult> {
  const check = await checkPlan(planId);
  if (!check.ok) return check.result!;

  const hours = Math.min(168, Math.max(1, Number(search.get("hours") ?? 24)));
  const { times, bucketMinutes } = buckets(hours, new Date());
  const rng = seededRng(planId + "errors");

  const series = times.map((t) => ({
    bucket: fmtBucket(t),
    dns: 0,
    tcp: rng() > 0.9 ? 1 : 0,
    tls: 0,
    timeout: rng() > 0.95 ? 1 : 0,
    auth: 0,
    upstream_4xx: 0,
    upstream_5xx: 0,
    zero_byte: rng() > 0.85 ? Math.floor(rng() * 3) : 0,
    proxy_internal: 0,
    client_disconnect: 0,
    socks5_protocol: 0,
    bad_request: 0,
    conn_limit: 0,
    bandwidth_quota: 0,
    blacklisted: 0,
    upstream_select: 0,
  }));

  return {
    status: 200,
    body: { success: true, data: { hours, bucket_minutes: bucketMinutes, series } },
  };
}

export async function metricsStatusCodes(
  planId: string,
  search: URLSearchParams,
): Promise<HandlerResult> {
  const check = await checkPlan(planId);
  if (!check.ok) return check.result!;

  const hours = Math.min(168, Math.max(1, Number(search.get("hours") ?? 24)));
  const { times, bucketMinutes } = buckets(hours, new Date());
  const rng = seededRng(planId + "status");

  const series = times.map((t) => {
    const s2xx = Math.floor(rng() * 20 + 5);
    return { bucket: fmtBucket(t), s2xx, s3xx: 0, s4xx: rng() > 0.9 ? 1 : 0, s5xx: 0 };
  });

  return {
    status: 200,
    body: { success: true, data: { hours, bucket_minutes: bucketMinutes, series } },
  };
}

export async function metricsDestinations(
  planId: string,
  search: URLSearchParams,
): Promise<HandlerResult> {
  const check = await checkPlan(planId);
  if (!check.ok) return check.result!;

  const hours = Math.min(168, Math.max(1, Number(search.get("hours") ?? 24)));
  const rng = seededRng(planId + "destinations");

  const hosts = [
    "api.example.com:443",
    "target.io:443",
    "data.scrape.net:80",
    "proof.ovh.net:443",
    "check.site:443",
  ];
  const destinations = hosts.map((destination) => ({
    destination,
    connections: Math.floor(rng() * 50 + 5),
    successes: Math.floor(rng() * 48 + 5),
    errors: Math.floor(rng() * 2),
    mb_received: +(rng() * 40 + 1).toFixed(2),
    mb_sent: +(rng() * 2).toFixed(3),
    p95_ms: Math.floor(rng() * 30000 + 5000),
  }));

  return { status: 200, body: { success: true, data: { hours, destinations } } };
}

export async function metricsHourlyUsage(
  planId: string,
  search: URLSearchParams,
): Promise<HandlerResult> {
  const check = await checkPlan(planId);
  if (!check.ok) return check.result!;

  const hours = Math.min(168, Math.max(1, Number(search.get("hours") ?? 24)));
  const rng = seededRng(planId + "hourly");
  const now = new Date();

  const hourly = Array.from({ length: hours }, (_, i) => {
    const h = new Date(now.getTime() - (hours - 1 - i) * 60 * 60 * 1000);
    h.setMinutes(0, 0, 0);
    return { hour: fmtBucket(h), gb: +(rng() * 0.4).toFixed(3) };
  });

  const total_gb = +hourly.reduce((s, h) => s + h.gb, 0).toFixed(3);

  return { status: 200, body: { success: true, data: { hours, total_gb, hourly } } };
}

export async function metricsErrorMessages(
  planId: string,
  search: URLSearchParams,
): Promise<HandlerResult> {
  const check = await checkPlan(planId);
  if (!check.ok) return check.result!;

  const hours = Math.min(168, Math.max(1, Number(search.get("hours") ?? 24)));
  const rng = seededRng(planId + "errmsg");

  const messages =
    rng() > 0.4
      ? [
          {
            error_type: "tcp_connect",
            message: "dial tcp [redacted]: connect: connection refused",
            count: Math.floor(rng() * 40 + 5),
            last_seen: new Date(Date.now() - Math.floor(rng() * 3600000))
              .toISOString()
              .replace("T", " ")
              .slice(0, 19),
            sample_destination: "api.example.com:443",
          },
        ]
      : [];

  return { status: 200, body: { success: true, data: { hours, messages } } };
}

export async function getMetrics(
  planId: string,
  metric: string,
  search: URLSearchParams,
): Promise<HandlerResult> {
  switch (metric) {
    case "summary":
      return metricsSummary(planId, search);
    case "throughput":
      return metricsThroughput(planId, search);
    case "latency":
      return metricsLatency(planId, search);
    case "errors":
      return metricsErrors(planId, search);
    case "status-codes":
      return metricsStatusCodes(planId, search);
    case "destinations":
      return metricsDestinations(planId, search);
    case "hourly-usage":
      return metricsHourlyUsage(planId, search);
    case "error-messages":
      return metricsErrorMessages(planId, search);
    default:
      return {
        status: 404,
        body: { success: false, error: { code: "NOT_FOUND", message: "Unknown metric" } },
      };
  }
}
