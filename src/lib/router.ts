import {
  getBalance,
  getTransactions,
  getPricing,
  createCryptoTopup,
  verifyPayment,
  getUsageSummary,
  directTopup,
} from "@/lib/handlers/balance";
import {
  listPlans,
  getPlan,
  createPlan,
  cancelPlan,
  extendPlan,
  updatePassword,
  updateAllowedIps,
  getPlanProxies,
  checkPriceHandler,
} from "@/lib/handlers/plans";
import { getMetrics } from "@/lib/handlers/metrics";
import {
  startInvestigation,
  getInvestigation,
  listInvestigations,
} from "@/lib/handlers/investigate";
import { listSubUsers, createSubUser, updateSubUser, getSubUser } from "@/lib/handlers/subusers";
import { listPools, getPool, getServerStats, getGeoCatalog } from "@/lib/handlers/pools";

export type HandlerResult = { status: number; body: unknown };

type RouteContext = {
  method: string;
  segments: string[];
  search: URLSearchParams;
  body: unknown;
};

export async function routeRequest(ctx: RouteContext): Promise<HandlerResult> {
  const { method, segments, search, body } = ctx;
  const [seg0, seg1, seg2, seg3] = segments;

  // ── Balance ───────────────────────────────────────────────────────────────
  if (method === "GET" && seg0 === "balance" && !seg1) return getBalance();
  if (method === "GET" && seg0 === "balance" && seg1 === "transactions")
    return getTransactions(search);
  if (method === "GET" && seg0 === "balance" && seg1 === "pricing") return getPricing();
  if (method === "GET" && seg0 === "balance" && seg1 === "usage") return getUsageSummary(search);

  // GET /usage/summary — legacy path used by api.ts client helpers
  if (method === "GET" && seg0 === "usage" && seg1 === "summary") return getUsageSummary(search);

  // POST /balance/topup/direct — admin direct top-up (adds balance immediately)
  if (method === "POST" && seg0 === "balance" && seg1 === "topup" && seg2 === "direct")
    return directTopup(body);

  // POST /balance/topup or /balance/topup/crypto — crypto stub
  if (method === "POST" && seg0 === "balance" && seg1 === "topup") return createCryptoTopup(body);

  // GET /balance/topup/:id/verify — old verify path
  if (method === "GET" && seg0 === "balance" && seg1 === "topup" && seg2 && seg3 === "verify")
    return verifyPayment(seg2);

  // GET /balance/verify-payment/:id — path used by api.ts
  if (method === "GET" && seg0 === "balance" && seg1 === "verify-payment" && seg2)
    return verifyPayment(seg2);

  // ── Plans ─────────────────────────────────────────────────────────────────
  // check-price must come before generic /:planId to avoid being shadowed
  if (method === "POST" && seg0 === "plans" && seg1 === "check-price")
    return checkPriceHandler(body);

  if (method === "GET" && seg0 === "plans" && !seg1) return listPlans(search);
  if (method === "POST" && seg0 === "plans" && !seg1) return createPlan(body);

  if (method === "GET" && seg0 === "plans" && seg1 && !seg2) return getPlan(seg1);
  if (method === "DELETE" && seg0 === "plans" && seg1 && !seg2) return cancelPlan(seg1);

  if (method === "POST" && seg0 === "plans" && seg1 && seg2 === "extend")
    return extendPlan(seg1, body);

  // Password — accept both PUT (api.ts / PlanCredentials) and PATCH
  if ((method === "PUT" || method === "PATCH") && seg0 === "plans" && seg1 && seg2 === "password")
    return updatePassword(seg1, body);

  // Allowed IPs — accept both PUT and PATCH
  if (
    (method === "PUT" || method === "PATCH") &&
    seg0 === "plans" &&
    seg1 &&
    seg2 === "allowed-ips"
  )
    return updateAllowedIps(seg1, body);

  if (method === "GET" && seg0 === "plans" && seg1 && seg2 === "proxies")
    return getPlanProxies(seg1);

  // Metrics: GET /plans/:planId/metrics/:metric
  if (method === "GET" && seg0 === "plans" && seg1 && seg2 === "metrics" && seg3)
    return getMetrics(seg1, seg3, search);

  // ── Investigations ────────────────────────────────────────────────────────
  if (method === "POST" && seg0 === "investigate" && seg1 && !seg2)
    return startInvestigation(seg1, body);
  if (method === "GET" && seg0 === "investigate" && seg1 && !seg2) return listInvestigations(seg1);
  if (method === "GET" && seg0 === "investigate" && seg1 && seg2 && !seg3)
    return getInvestigation(seg1, seg2);

  // ── Sub-users ─────────────────────────────────────────────────────────────
  if (method === "GET" && seg0 === "sub-users" && !seg1) return listSubUsers(search);
  if (method === "POST" && seg0 === "sub-users" && !seg1) return createSubUser(body);
  if (method === "GET" && seg0 === "sub-users" && seg1 && !seg2) return getSubUser(seg1);
  // Accept both PUT (api.ts) and PATCH
  if ((method === "PUT" || method === "PATCH") && seg0 === "sub-users" && seg1 && !seg2)
    return updateSubUser(seg1, body);

  // ── ISP Pools ─────────────────────────────────────────────────────────────
  // GET /proxies/pools — used by CreatePlanForm for dedicated_isp pool selection
  if (method === "GET" && seg0 === "proxies" && seg1 === "pools") return listPools(search);

  if (method === "GET" && seg0 === "pools" && !seg1) return listPools(search);
  if (method === "GET" && seg0 === "pools" && seg1 === "stats") return getServerStats();
  if (method === "GET" && seg0 === "pools" && seg1 === "geo") return getGeoCatalog(search);
  if (method === "GET" && seg0 === "pools" && seg1 && !seg2) return getPool(seg1);

  // ── Servers (stubs) ───────────────────────────────────────────────────────
  if (method === "GET" && seg0 === "servers" && seg1 && seg2 === "stats") {
    return {
      status: 200,
      body: {
        success: true,
        data: {
          plan_id: seg1,
          server: { status: "running", uptime_seconds: 86400, uptime_formatted: "1d 0h" },
          resources: {
            cpu_percent: 12,
            memory_used_mb: 512,
            memory_total_mb: 2048,
            memory_percent: 25,
          },
          network: { bytes_in: 1e9, bytes_out: 5e8, current_mbps: 3.2 },
          updated_at: new Date().toISOString(),
        },
      },
    };
  }
  if (method === "POST" && seg0 === "servers" && seg1 && seg2 === "restart") {
    return {
      status: 200,
      body: { success: true, data: { plan_id: seg1, message: "Restart initiated" } },
    };
  }

  return {
    status: 404,
    body: {
      success: false,
      error: { code: "NOT_FOUND", message: `No route for ${method} /${segments.join("/")}` },
    },
  };
}
