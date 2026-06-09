import type {
  ProductType,
  CreatePlanRequest,
  CheckPriceResponse,
  ProductPricing,
} from "@/types/api";

export const PRICING_TABLE: Record<string, ProductPricing> = {
  "residential-lite": { billing: "bandwidth", price_per_gb: 50, price_per_gb_formatted: "$0.50" },
  residential: { billing: "bandwidth", price_per_gb: 300, price_per_gb_formatted: "$3.00" },
  mobile: { billing: "bandwidth", price_per_gb: 500, price_per_gb_formatted: "$5.00" },
  mobile_usa: { billing: "bandwidth", price_per_gb: 500, price_per_gb_formatted: "$5.00" },
  datacenter: {
    billing: "hybrid",
    price_per_gb: 100,
    price_per_gb_formatted: "$1.00",
    price_per_day_cents: 200,
    price_per_day_formatted: "$2.00",
  },
  shared_isp: {
    billing: "hybrid",
    price_per_gb: 100,
    price_per_gb_formatted: "$1.00",
    price_per_day_cents: 200,
    price_per_day_formatted: "$2.00",
  },
  "ipv6-residential": {
    billing: "hybrid",
    price_per_gb: 100,
    price_per_gb_formatted: "$1.00",
    price_per_day_cents: 200,
    price_per_day_formatted: "$2.00",
  },
  "ipv6-datacenter": {
    billing: "hybrid",
    price_per_gb: 100,
    price_per_gb_formatted: "$1.00",
    price_per_day_cents: 200,
    price_per_day_formatted: "$2.00",
  },
  pool1: { billing: "bandwidth", price_per_gb: 50, price_per_gb_formatted: "$0.50" },
  pool2: { billing: "bandwidth", price_per_gb: 50, price_per_gb_formatted: "$0.50" },
  pool3: { billing: "bandwidth", price_per_gb: 50, price_per_gb_formatted: "$0.50" },
  pool4: { billing: "bandwidth", price_per_gb: 50, price_per_gb_formatted: "$0.50" },
  pool5: { billing: "bandwidth", price_per_gb: 50, price_per_gb_formatted: "$0.50" },
  unlimited_residential: {
    billing: "time",
    trial_price_cents: 50,
    trial_price_formatted: "$0.50",
    pricing_tiers: [
      { bandwidth_mbps: 200, price_per_day_cents: 5000 },
      { bandwidth_mbps: 500, price_per_day_cents: 15000 },
      { bandwidth_mbps: 1000, price_per_day_cents: 25000 },
      { bandwidth_mbps: 2000, price_per_day_cents: 45000 },
      { bandwidth_mbps: 3000, price_per_day_cents: 65000 },
    ],
  },
  dedicated_isp: { billing: "bandwidth", price_per_gb: 1500, price_per_gb_formatted: "$15.00" },
};

export const CONNECTION_INFO: Record<
  string,
  { hostname: string; port_http: number; port_socks: number | null }
> = {
  "residential-lite": { hostname: "lite.proxyserver.bot", port_http: 6969, port_socks: 9696 },
  residential: { hostname: "geo.proxyserver.bot", port_http: 8080, port_socks: 1080 },
  mobile: { hostname: "geo.proxyserver.bot", port_http: 8080, port_socks: 1080 },
  mobile_usa: { hostname: "v3-resi-us.proxyserver.bot", port_http: 10000, port_socks: 11000 },
  datacenter: { hostname: "v3-dc.proxyserver.bot", port_http: 777, port_socks: 666 },
  shared_isp: { hostname: "v3-isp.proxyserver.bot", port_http: 30, port_socks: 31 },
  "ipv6-residential": { hostname: "v3-v6-resi.proxyserver.bot", port_http: 30, port_socks: 31 },
  "ipv6-datacenter": { hostname: "v3-v6-dc.proxyserver.bot", port_http: 50, port_socks: 51 },
  pool1: { hostname: "v3-resi-us.proxyserver.bot", port_http: 10000, port_socks: 11000 },
  pool2: { hostname: "v3-resi-us.proxyserver.bot", port_http: 10001, port_socks: 11001 },
  pool3: { hostname: "v3-resi-us.proxyserver.bot", port_http: 10002, port_socks: 11002 },
  pool4: { hostname: "v3-resi-us.proxyserver.bot", port_http: 10003, port_socks: 11003 },
  pool5: { hostname: "v3-resi-us.proxyserver.bot", port_http: 10004, port_socks: 11004 },
  unlimited_residential: {
    hostname: "unlim.proxyserver.bot",
    port_http: 10507,
    port_socks: 10507,
  },
  dedicated_isp: { hostname: "dedicated.proxyserver.bot", port_http: 61234, port_socks: null },
};

export const DURATION_DAYS: Record<string, number> = {
  trial: 30 / (24 * 60),
  "1_hour": 1 / 24,
  "1_day": 1,
  "7_days": 7,
  "14_days": 14,
  "30_days": 30,
  "60_days": 60,
  "90_days": 90,
};

export function computePrice(body: CreatePlanRequest): CheckPriceResponse {
  const product = body.product as ProductType;
  const pricing = PRICING_TABLE[product];
  if (!pricing) throw new Error(`Unknown product: ${product}`);

  if (pricing.billing === "bandwidth") {
    const gb = body.bandwidth_gb ?? 0;
    const costCents = Math.ceil(gb * (pricing.price_per_gb ?? 0));
    return {
      cost_cents: costCents,
      cost_usd: (costCents / 100).toFixed(2),
      mode: "price",
    };
  }

  if (pricing.billing === "hybrid") {
    if (body.billing_type === "time") {
      const days = DURATION_DAYS[body.duration ?? "1_day"] ?? 1;
      const mbps = body.mbps ?? 100;
      const costCents = Math.ceil(days * (pricing.price_per_day_cents ?? 0) * (mbps / 100));
      return {
        cost_cents: costCents,
        cost_usd: (costCents / 100).toFixed(2),
        mode: "price",
      };
    }
    const gb = body.bandwidth_gb ?? 0;
    const costCents = Math.ceil(gb * (pricing.price_per_gb ?? 0));
    return {
      cost_cents: costCents,
      cost_usd: (costCents / 100).toFixed(2),
      mode: "price",
    };
  }

  if (pricing.billing === "time") {
    if (body.duration === "trial") {
      return {
        cost_cents: pricing.trial_price_cents ?? 50,
        cost_usd: ((pricing.trial_price_cents ?? 50) / 100).toFixed(2),
        mode: "price_only",
        trial_info: {
          trials_used_today: 0,
          discounted_trials_remaining: 10,
          price_applied: "discounted",
          discounted_price_cents: pricing.trial_price_cents ?? 50,
          full_price_cents: 150,
          daily_discount_limit: 10,
        },
      };
    }
    const days = DURATION_DAYS[body.duration ?? "30_days"] ?? 30;
    const mbps = body.bandwidth_mbps ?? 500;
    const tiers = pricing.pricing_tiers ?? [];
    const tier = tiers.find((t) => t.bandwidth_mbps >= mbps) ?? tiers[tiers.length - 1];
    const costCents = Math.ceil(days * (tier?.price_per_day_cents ?? 15000));
    return {
      cost_cents: costCents,
      cost_usd: (costCents / 100).toFixed(2),
      mode: "price_only",
    };
  }

  // dedicated_isp — per IP per 30 days
  const qty = body.quantity ?? 1;
  const costCents = qty * 1500;
  return {
    cost_cents: costCents,
    cost_usd: (costCents / 100).toFixed(2),
    mode: "price_only",
  };
}

export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
