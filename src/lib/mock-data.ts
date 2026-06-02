import type { Plan, MetricsSummary, UsageSummary, ThroughputData, LatencyData } from "@/types/api";

export const MOCK_PLANS: Plan[] = [
  {
    plan_id: "3cd1f4b9-efc3-4252-b9f7-9cebc5236164",
    product: "residential-lite",
    billing_type: "bandwidth",
    proxy_username: "mock_user_1",
    proxy_password: "mock-password",
    connection: {
      hostname: "mock.proxy.local",
      port_http: 1111,
      port_socks: 2222,
      format: "mock_user_1:mock-password@mock.proxy.local:1111",
    },
    limits: {
      max_gb: 10,
      max_bytes: 10_000_000_000,
      bytes_used: 2_500_000_000,
    },
    status: "active",
    expires_at: "2026-08-15T00:00:00.000Z",
    created_at: "2026-06-01T10:00:00.000Z",
    purchase_price_cents: 1250,
  },
  {
    plan_id: "0e1769e9-8bee-48df-8d2c-4a5dd9a2591e",
    product: "dedicated_isp",
    billing_type: "time",
    proxy_username: "mock_user_2",
    proxy_password: "mock-password",
    connection: {
      hostname: "mock.proxy.local",
      port_http: 2222,
      port_socks: 3333,
      format: "mock_user_2:mock-password@mock.proxy.local:2222",
    },
    limits: {
      max_gb: null,
      max_bytes: null,
      bytes_used: 0,
    },
    status: "active",
    expires_at: "2026-09-01T00:00:00.000Z",
    created_at: "2026-06-01T12:00:00.000Z",
    purchase_price_cents: 10000,
    allowed_ips: ["127.0.0.1", "10.0.0.1"],
  },
  {
    plan_id: "ca2dc1f7-8d76-438f-b265-bf9fce9b183a",
    product: "residential",
    billing_type: "bandwidth",
    proxy_username: "mock_user_3",
    proxy_password: "mock-password",
    connection: {
      hostname: "mock.proxy.local",
      port_http: 3333,
      port_socks: 4444,
      format: "mock_user_3:mock-password@mock.proxy.local:3333",
    },
    limits: {
      max_gb: 5,
      max_bytes: 5_000_000_000,
      bytes_used: 5_000_000_000,
    },
    status: "expired",
    expires_at: "2026-05-01T00:00:00.000Z",
    created_at: "2026-04-01T08:00:00.000Z",
    purchase_price_cents: 750,
  },
  {
    plan_id: "f8a3c2e1-7b45-4d92-a1f6-3e8d5c9b0a12",
    product: "datacenter",
    billing_type: "bandwidth",
    proxy_username: "mock_user_4",
    proxy_password: "mock-password",
    connection: {
      hostname: "mock.proxy.local",
      port_http: 4444,
      port_socks: 5555,
      format: "mock_user_4:mock-password@mock.proxy.local:4444",
    },
    limits: {
      max_gb: 20,
      max_bytes: 20_000_000_000,
      bytes_used: 4_200_000_000,
    },
    status: "active",
    expires_at: "2026-07-30T00:00:00.000Z",
    created_at: "2026-05-15T14:30:00.000Z",
    purchase_price_cents: 2000,
    location: "NL",
  },
  {
    plan_id: "b1e4d8f2-3a67-4c89-b5e2-9f1a7d3c6e04",
    product: "mobile",
    billing_type: "bandwidth",
    proxy_username: "mock_user_5",
    proxy_password: "mock-password",
    connection: {
      hostname: "mock.proxy.local",
      port_http: 5555,
      port_socks: null,
      format: "mock_user_5:mock-password@mock.proxy.local:5555",
    },
    limits: {
      max_gb: 2,
      max_bytes: 2_000_000_000,
      bytes_used: 100_000_000,
    },
    status: "cancelled",
    expires_at: null,
    created_at: "2026-03-10T09:00:00.000Z",
    purchase_price_cents: 500,
  },
];

export function getMockPlan(planId: string): Plan | undefined {
  return MOCK_PLANS.find((p) => p.plan_id === planId);
}

// Mock metrics — only for plan types that support it (datacenter, shared_isp, ipv6-*)
const MOCK_METRICS: Record<string, MetricsSummary> = {
  // datacenter plan
  "f8a3c2e1-7b45-4d92-a1f6-3e8d5c9b0a12": {
    hours: 24,
    total_bytes: 4_200_000_000,
    total_mb: 4200,
    total_connections: 12543,
    total_successes: 12389,
    total_errors: 154,
    success_rate_pct: 98.77,
    peak_concurrent: 67,
    avg_mbps: 3.24,
    peak_mbps: 24.8,
  },
};

export function getMockMetrics(planId: string): MetricsSummary | undefined {
  return MOCK_METRICS[planId];
}

// 30 days of deterministic daily bandwidth usage for the Overview chart
export const MOCK_USAGE: UsageSummary = {
  time_range: { start: 1_780_000_000, end: 1_782_592_000, period: "day" },
  summary: {
    total_bytes: 14_523_000_000,
    total_gb: 14.52,
    total_requests: 125_000,
    active_plans: 2,
  },
  by_product: {
    "residential-lite": { bytes: 8_000_000_000, plans: 1 },
    datacenter: { bytes: 6_523_000_000, plans: 1 },
  },
  daily_breakdown: Array.from({ length: 30 }, (_, i) => {
    const d = new Date("2026-06-02T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() - (29 - i));
    const mb = 150 + ((i * 73 + 23) % 650);
    const bytes = mb * 1_000_000;
    return {
      date: d.toISOString().slice(0, 10),
      bytes,
      gb: Number.parseFloat((bytes / 1_000_000_000).toFixed(2)),
    };
  }),
};

// 24 hourly buckets of mock throughput + latency for the Datacenter plan metrics charts
const MOCK_BUCKETS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date("2026-06-02T00:00:00.000Z");
  d.setUTCHours(i);
  return d.toISOString();
});

export const MOCK_THROUGHPUT: ThroughputData = {
  hours: 24,
  bucket_minutes: 60,
  series: MOCK_BUCKETS.map((bucket, i) => ({
    bucket,
    mbps: Number.parseFloat((10 + ((i * 17 + 3) % 70)).toFixed(1)),
    rate_cap_mbps: 100,
  })),
};

export const MOCK_LATENCY: LatencyData = {
  hours: 24,
  bucket_minutes: 60,
  series: MOCK_BUCKETS.map((bucket, i) => ({
    bucket,
    p50: 20 + ((i * 7 + 5) % 20),
    p95: 55 + ((i * 11 + 3) % 35),
    p99: 110 + ((i * 13 + 7) % 70),
  })),
};
