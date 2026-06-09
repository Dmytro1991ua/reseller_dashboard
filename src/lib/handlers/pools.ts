import type { HandlerResult } from "@/lib/router";

const ISP_POOLS = [
  {
    id: "us-isp-01",
    name: "US ISP Pool 01",
    country: "US",
    city: "Chicago",
    isp: "AT&T",
    available_ips: 1200,
    total_ips: 2000,
    uptime_pct: 99.8,
    avg_latency_ms: 45,
  },
  {
    id: "us-isp-02",
    name: "US ISP Pool 02",
    country: "US",
    city: "Dallas",
    isp: "Comcast",
    available_ips: 800,
    total_ips: 1500,
    uptime_pct: 99.5,
    avg_latency_ms: 38,
  },
  {
    id: "gb-isp-01",
    name: "GB ISP Pool 01",
    country: "GB",
    city: "London",
    isp: "BT",
    available_ips: 600,
    total_ips: 1000,
    uptime_pct: 99.9,
    avg_latency_ms: 22,
  },
  {
    id: "de-isp-01",
    name: "DE ISP Pool 01",
    country: "DE",
    city: "Frankfurt",
    isp: "Deutsche Telekom",
    available_ips: 400,
    total_ips: 800,
    uptime_pct: 99.7,
    avg_latency_ms: 18,
  },
  {
    id: "ca-isp-01",
    name: "CA ISP Pool 01",
    country: "CA",
    city: "Toronto",
    isp: "Rogers",
    available_ips: 300,
    total_ips: 600,
    uptime_pct: 99.6,
    avg_latency_ms: 52,
  },
  {
    id: "au-isp-01",
    name: "AU ISP Pool 01",
    country: "AU",
    city: "Sydney",
    isp: "Telstra",
    available_ips: 250,
    total_ips: 500,
    uptime_pct: 99.4,
    avg_latency_ms: 120,
  },
  {
    id: "fr-isp-01",
    name: "FR ISP Pool 01",
    country: "FR",
    city: "Paris",
    isp: "Orange",
    available_ips: 350,
    total_ips: 700,
    uptime_pct: 99.8,
    avg_latency_ms: 20,
  },
  {
    id: "nl-isp-01",
    name: "NL ISP Pool 01",
    country: "NL",
    city: "Amsterdam",
    isp: "KPN",
    available_ips: 500,
    total_ips: 900,
    uptime_pct: 99.9,
    avg_latency_ms: 15,
  },
];

const GEO_CATALOG = [
  {
    code: "US",
    name: "United States",
    region: "Americas",
    cities: ["New York", "Los Angeles", "Chicago", "Dallas", "Miami"],
  },
  {
    code: "GB",
    name: "United Kingdom",
    region: "Europe",
    cities: ["London", "Manchester", "Birmingham"],
  },
  { code: "DE", name: "Germany", region: "Europe", cities: ["Frankfurt", "Berlin", "Munich"] },
  { code: "FR", name: "France", region: "Europe", cities: ["Paris", "Lyon", "Marseille"] },
  { code: "NL", name: "Netherlands", region: "Europe", cities: ["Amsterdam", "Rotterdam"] },
  { code: "CA", name: "Canada", region: "Americas", cities: ["Toronto", "Vancouver", "Montreal"] },
  { code: "AU", name: "Australia", region: "APAC", cities: ["Sydney", "Melbourne", "Brisbane"] },
  { code: "SG", name: "Singapore", region: "APAC", cities: ["Singapore"] },
  { code: "JP", name: "Japan", region: "APAC", cities: ["Tokyo", "Osaka"] },
  { code: "BR", name: "Brazil", region: "Americas", cities: ["São Paulo", "Rio de Janeiro"] },
];

const SERVER_STATS = {
  global_uptime_pct: 99.7,
  active_connections: 42180,
  total_pools: ISP_POOLS.length,
  healthy_pools: ISP_POOLS.length,
  bandwidth_utilization_pct: 34.2,
  incidents_last_30d: 0,
  regions: [
    { region: "Americas", pools: 3, active_connections: 18200, uptime_pct: 99.6 },
    { region: "Europe", pools: 4, active_connections: 20100, uptime_pct: 99.8 },
    { region: "APAC", pools: 1, active_connections: 3880, uptime_pct: 99.4 },
  ],
};

export async function listPools(search: URLSearchParams): Promise<HandlerResult> {
  const country = search.get("country");
  const filtered = country
    ? ISP_POOLS.filter((p) => p.country === country.toUpperCase())
    : ISP_POOLS;
  return {
    status: 200,
    body: { success: true, data: { pools: filtered, total: filtered.length } },
  };
}

export async function getPool(poolId: string): Promise<HandlerResult> {
  const pool = ISP_POOLS.find((p) => p.id === poolId);
  if (!pool) {
    return {
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "Pool not found" } },
    };
  }
  return { status: 200, body: { success: true, data: pool } };
}

export async function getServerStats(): Promise<HandlerResult> {
  return { status: 200, body: { success: true, data: SERVER_STATS } };
}

export async function getGeoCatalog(search: URLSearchParams): Promise<HandlerResult> {
  const region = search.get("region");
  const filtered = region ? GEO_CATALOG.filter((g) => g.region === region) : GEO_CATALOG;
  return { status: 200, body: { success: true, data: { locations: filtered } } };
}
