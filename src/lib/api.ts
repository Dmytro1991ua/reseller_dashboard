/**
 * Browser-side API helper.
 * Calls /api/proxy/* which injects the server-side API key.
 */

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  searchParams?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, searchParams, idempotencyKey } = options;

  const url = new URL(`/api/proxy${path}`, window.location.origin);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;

  const res = await fetch(url.toString(), {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = await res.json();

  if (!res.ok || json.success === false) {
    const err = json?.error;
    throw new ApiError(
      err?.message ?? `HTTP ${res.status}`,
      err?.code ?? "UNKNOWN",
      res.status,
      err?.details,
    );
  }

  return json.data as T;
}

// ─── Typed helpers ─────────────────────────────────────────────────────────

import type {
  Balance,
  TransactionsData,
  Plan,
  PlansListData,
  CheckPriceResponse,
  CreatePlanRequest,
  PoolListData,
  MetricsSummary,
  ThroughputData,
  LatencyData,
  ErrorsData,
  StatusCodesData,
  DestinationsData,
  HourlyUsageData,
  ErrorMessagesData,
  UsageSummary,
  Investigation,
  SubUser,
  SubUsersData,
  ProxyListData,
  ServerStats,
  CryptoTopupData,
  VerifyPaymentData,
  ProductPricing,
} from "@/types/api";

// Balance
export const getBalance = () => apiRequest<Balance>("/balance");
export const getTransactions = (params?: { page?: number; per_page?: number; type?: string }) =>
  apiRequest<TransactionsData>("/balance/transactions", { searchParams: params });
export const getPricing = () => apiRequest<Record<string, ProductPricing>>("/balance/pricing");
export const createCryptoTopup = (body: {
  amount_cents: number;
  currency: string;
  network: string;
}) => apiRequest<CryptoTopupData>("/balance/topup/crypto", { method: "POST", body });
export const verifyPayment = (trackingId: string) =>
  apiRequest<VerifyPaymentData>(`/balance/verify-payment/${trackingId}`);

// Plans
export const listPlans = (params?: {
  page?: number;
  per_page?: number;
  status?: string;
  product?: string;
  sort?: string;
  order?: string;
  search?: string;
}) => apiRequest<PlansListData>("/plans", { searchParams: params });

export const getPlan = (planId: string) => apiRequest<Plan>(`/plans/${planId}`);

export const createPlan = (body: CreatePlanRequest, idempotencyKey?: string) =>
  apiRequest<Plan>("/plans", { method: "POST", body, idempotencyKey });

export const checkPrice = (body: CreatePlanRequest) =>
  apiRequest<CheckPriceResponse>("/plans/check-price", { method: "POST", body });

export const cancelPlan = (planId: string) =>
  apiRequest<{ plan_id: string; status: string; message: string; cancelled_at: string }>(
    `/plans/${planId}`,
    { method: "DELETE" },
  );

export const extendPlan = (
  planId: string,
  body: { add_bandwidth_gb?: number; add_days?: number; extend_30_days?: boolean },
  idempotencyKey?: string,
) => apiRequest(`/plans/${planId}/extend`, { method: "POST", body, idempotencyKey });

export const updatePassword = (planId: string, newPassword: string) =>
  apiRequest(`/plans/${planId}/password`, { method: "PUT", body: { new_password: newPassword } });

export const updateAllowedIps = (planId: string, ips: string[]) =>
  apiRequest(`/plans/${planId}/allowed-ips`, { method: "PUT", body: { allowed_ips: ips } });

// Metrics
export const getMetricsSummary = (planId: string, hours = 24) =>
  apiRequest<MetricsSummary>(`/plans/${planId}/metrics/summary`, { searchParams: { hours } });
export const getMetricsThroughput = (planId: string, hours = 24) =>
  apiRequest<ThroughputData>(`/plans/${planId}/metrics/throughput`, { searchParams: { hours } });
export const getMetricsLatency = (planId: string, hours = 24) =>
  apiRequest<LatencyData>(`/plans/${planId}/metrics/latency`, { searchParams: { hours } });
export const getMetricsErrors = (planId: string, hours = 24) =>
  apiRequest<ErrorsData>(`/plans/${planId}/metrics/errors`, { searchParams: { hours } });
export const getMetricsStatusCodes = (planId: string, hours = 24) =>
  apiRequest<StatusCodesData>(`/plans/${planId}/metrics/status-codes`, { searchParams: { hours } });
export const getMetricsDestinations = (planId: string, hours = 24, limit = 30) =>
  apiRequest<DestinationsData>(`/plans/${planId}/metrics/destinations`, {
    searchParams: { hours, limit },
  });
export const getMetricsHourlyUsage = (planId: string, hours = 24) =>
  apiRequest<HourlyUsageData>(`/plans/${planId}/metrics/hourly-usage`, { searchParams: { hours } });
export const getMetricsErrorMessages = (planId: string, hours = 24) =>
  apiRequest<ErrorMessagesData>(`/plans/${planId}/metrics/error-messages`, {
    searchParams: { hours },
  });

// ISP Pools & Proxy List
export const getIspPools = (params?: { type?: "isp" | "subnet"; country?: string }) =>
  apiRequest<PoolListData>("/proxies/pools", { searchParams: params });
export const getPlanProxies = (planId: string) =>
  apiRequest<ProxyListData>(`/plans/${planId}/proxies`);

// Usage
export const getUsageSummary = (period?: "today" | "week" | "month" | "all") =>
  apiRequest<UsageSummary>("/usage/summary", { searchParams: { period } });

// Investigations
export const startInvestigation = (planId: string, complaint: string) =>
  apiRequest<{
    investigation_id: string;
    status: string;
    estimated_seconds: number;
    poll_url: string;
  }>(`/investigate/${planId}`, { method: "POST", body: { complaint } });
export const getInvestigation = (planId: string, investigationId: string) =>
  apiRequest<Investigation>(`/investigate/${planId}/${investigationId}`);
export const listInvestigations = (planId: string) =>
  apiRequest<{ plan_id: string; investigations: Investigation[] }>(`/investigate/${planId}`);

// Sub-users
export const listSubUsers = (params?: { page?: number; per_page?: number; status?: string }) =>
  apiRequest<SubUsersData>("/sub-users", { searchParams: params });
export const createSubUser = (body: {
  email: string;
  name: string;
  initial_balance_cents?: number;
}) => apiRequest<SubUser>("/sub-users", { method: "POST", body });
export const updateSubUser = (
  id: string,
  body: { name?: string; status?: "active" | "suspended"; add_balance_cents?: number },
) => apiRequest<SubUser>(`/sub-users/${id}`, { method: "PUT", body });

// Servers
export const getServerStats = (planId: string) =>
  apiRequest<ServerStats>(`/servers/${planId}/stats`);
export const restartServer = (planId: string) =>
  apiRequest(`/servers/${planId}/restart`, { method: "POST" });
