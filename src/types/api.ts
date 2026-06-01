// ─── Common ────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

// ─── Balance ───────────────────────────────────────────────────────────────

export interface Allocation {
  allocated_gb?: number | null;
  used_gb?: number | null;
  remaining_gb?: number | null;
}

export interface Balance {
  balance_cents: number;
  balance_formatted: string;
  allocations: Record<string, Allocation>;
  total_spent_cents: number;
  total_spent_formatted: string;
}

export interface Transaction {
  id: string;
  type:
    | "topup"
    | "purchase"
    | "extend"
    | "refund"
    | "adjustment"
    | "allocation_usage"
    | "manual_refund"
    | "plan_creation"
    | "plan_extension"
    | "admin_credit"
    | "admin_debit"
    | "admin_adjustment";
  amount_cents: number;
  amount_formatted?: string;
  description: string;
  plan_id?: string | null;
  balance_after_cents?: number;
  created_at: string;
}

export interface TransactionsData {
  transactions: Transaction[];
  pagination: Pagination;
}

export interface ProductPricing {
  billing: "bandwidth" | "time" | "hybrid";
  price_per_gb?: number;
  price_per_gb_formatted?: string;
  price_per_day_cents?: number;
  price_per_day_formatted?: string;
  trial_price_cents?: number;
  trial_price_formatted?: string;
  pricing_tiers?: { bandwidth_mbps: number; price_per_day_cents: number }[];
}

// ─── Plans ─────────────────────────────────────────────────────────────────

export type ProductType =
  | "residential-lite"
  | "residential"
  | "mobile"
  | "mobile_usa"
  | "datacenter"
  | "shared_isp"
  | "ipv6-residential"
  | "ipv6-datacenter"
  | "pool1"
  | "pool2"
  | "pool3"
  | "pool4"
  | "pool5"
  | "unlimited_residential"
  | "dedicated_isp";

export type PlanStatus =
  | "pending"
  | "provisioning"
  | "active"
  | "inactive"
  | "expired"
  | "cancelled"
  | "failed";

export type BillingType = "bandwidth" | "time" | "per_ip";

export interface ConnectionInfo {
  hostname: string;
  port_http: number;
  port_socks?: number | null;
  format: string;
}

export interface PlanLimits {
  max_gb?: number | null;
  max_bytes?: number | null;
  bytes_used: number;
  max_mbps?: number | null;
}

export interface BillingInfo {
  mode: "price" | "allocation" | "price_only";
  price_per_gb?: number | null;
  gb_purchased?: number | null;
  cost_cents: number;
  cost_formatted: string;
  balance_before?: number | null;
  balance_after?: number | null;
  allocation_before?: number | null;
  allocation_after?: number | null;
  trial_info?: TrialInfo | null;
}

export interface TrialInfo {
  trials_used_today: number;
  discounted_trials_remaining: number;
  price_applied: "discounted" | "full";
  discounted_price_cents: number;
  full_price_cents: number;
  daily_discount_limit: number;
}

export interface ProxyItem {
  host: string;
  port: number;
  username: string;
  password: string;
  full: string;
}

export interface Plan {
  plan_id: string;
  product: ProductType;
  billing_type: BillingType;
  proxy_username: string;
  proxy_password: string;
  connection: ConnectionInfo;
  limits: PlanLimits;
  location?: string | null;
  expires_at?: string | null;
  status: PlanStatus;
  created_at: string;
  updated_at?: string | null;
  activated_at?: string | null;
  purchase_price_cents?: number | null;
  billing?: BillingInfo;
  end_user_reference?: string | null;
  allowed_ips?: string[];
  pool?: string | null;
  quantity?: number | null;
  proxy_list?: ProxyItem[] | null;
}

export interface PlansListData {
  plans: Plan[];
  pagination: Pagination;
}

export type PlanDuration =
  | "trial"
  | "1_hour"
  | "1_day"
  | "7_days"
  | "14_days"
  | "30_days"
  | "60_days"
  | "90_days";

export interface CreatePlanRequest {
  product: ProductType;
  bandwidth_gb?: number;
  duration?: PlanDuration;
  billing_type?: "bandwidth" | "time";
  mbps?: number;
  bandwidth_mbps?: number;
  location?: "NL" | "UK";
  quantity?: number;
  pool?: string;
  end_user_reference?: string;
  allowed_ips?: string[];
}

export interface CheckPriceResponse {
  cost_cents: number;
  cost_usd: string;
  mode: "price" | "allocation" | "price_only";
  gb_required?: number;
  allocation_available?: number;
  trial_info?: TrialInfo;
}

// ─── ISP Pools ─────────────────────────────────────────────────────────────

export interface IspPool {
  pool: string;
  inStock: boolean;
  stock: number;
  title: string;
  provider: "ISP" | "SN";
  isSubnet: boolean;
}

export interface PoolListData {
  pools: IspPool[];
  count: number;
  note?: string;
}

// ─── Proxies ───────────────────────────────────────────────────────────────

export interface ProxyListData {
  plan_id: string;
  count: number;
  proxies: ProxyItem[];
  pool?: string | null;
  expires_at: string;
  source: "provider" | "cached";
}

// ─── Metrics ───────────────────────────────────────────────────────────────

export interface MetricsSummary {
  hours: number;
  total_bytes: number;
  total_mb: number;
  total_connections: number;
  total_successes: number;
  total_errors: number;
  success_rate_pct: number | null;
  peak_concurrent: number;
  avg_mbps: number;
  peak_mbps: number;
}

export interface ThroughputPoint {
  bucket: string;
  mbps: number;
  rate_cap_mbps: number;
}

export interface ThroughputData {
  hours: number;
  bucket_minutes: number;
  series: ThroughputPoint[];
}

export interface LatencyPoint {
  bucket: string;
  p50: number;
  p95: number;
  p99: number;
}

export interface LatencyData {
  hours: number;
  bucket_minutes: number;
  series: LatencyPoint[];
}

export interface ErrorPoint {
  bucket: string;
  dns: number;
  tcp: number;
  tls: number;
  timeout: number;
  auth: number;
  upstream_4xx: number;
  upstream_5xx: number;
  zero_byte: number;
  proxy_internal: number;
  client_disconnect: number;
  socks5_protocol: number;
  bad_request: number;
  conn_limit: number;
  bandwidth_quota: number;
  blacklisted: number;
  upstream_select: number;
}

export interface ErrorsData {
  hours: number;
  bucket_minutes: number;
  series: ErrorPoint[];
}

export interface StatusCodePoint {
  bucket: string;
  s2xx: number;
  s3xx: number;
  s4xx: number;
  s5xx: number;
}

export interface StatusCodesData {
  hours: number;
  bucket_minutes: number;
  series: StatusCodePoint[];
}

export interface Destination {
  destination: string;
  connections: number;
  successes: number;
  errors: number;
  mb_received: number;
  mb_sent: number;
  p95_ms: number;
}

export interface DestinationsData {
  hours: number;
  destinations: Destination[];
}

export interface HourlyUsagePoint {
  hour: string;
  gb: number;
}

export interface HourlyUsageData {
  hours: number;
  total_gb: number;
  hourly: HourlyUsagePoint[];
}

export interface ErrorMessage {
  error_type: string;
  message: string;
  count: number;
  last_seen: string;
  sample_destination: string;
}

export interface ErrorMessagesData {
  hours: number;
  messages: ErrorMessage[];
}

// ─── Usage ─────────────────────────────────────────────────────────────────

export interface UsageSummary {
  period: string;
  total_bytes_used: number;
  total_bytes_formatted: string;
  by_product: Record<string, { bytes_used: number; bytes_formatted: string; plans_count: number }>;
  daily_breakdown: { date: string; bytes_used: number }[];
}

// ─── Investigations ────────────────────────────────────────────────────────

export type InvestigationStatus = "pending" | "running" | "complete" | "error";

export interface InvestigationEvidence {
  metric: string;
  value: string;
  context: string;
}

export interface InvestigationDiagnosis {
  severity: "info" | "warning" | "critical";
  headline: string;
  root_cause: string;
  evidence: InvestigationEvidence[];
  recommendation_to_customer: string;
  recommendation_to_staff: string;
}

export interface Investigation {
  investigation_id: string;
  status: InvestigationStatus;
  elapsed_seconds?: number | null;
  created_at: string;
  completed_at?: string | null;
  cost: string;
  refunded: boolean;
  severity?: "info" | "warning" | "critical" | null;
  headline?: string | null;
  diagnosis?: InvestigationDiagnosis | null;
  error?: string;
}

// ─── Sub-Users ─────────────────────────────────────────────────────────────

export interface SubUser {
  id: string;
  email: string;
  name: string;
  status: "active" | "suspended";
  balance_cents: number;
  plans_count: number;
  created_at: string;
  api_key?: string;
}

export interface SubUsersData {
  items: SubUser[];
  pagination: Pagination;
}

// ─── Servers ───────────────────────────────────────────────────────────────

export interface ServerStats {
  plan_id: string;
  server: { status: string; uptime_seconds: number; uptime_formatted: string };
  resources: {
    cpu_percent: number;
    memory_used_mb: number;
    memory_total_mb: number;
    memory_percent: number;
  };
  network: { bytes_in: number; bytes_out: number; current_mbps: number };
  updated_at: string;
}

// ─── Crypto Top-up ─────────────────────────────────────────────────────────

export interface CryptoTopupData {
  tracking_id: string;
  address: string;
  amount_crypto: string | null;
  currency: string;
  network: string;
  amount_usd_cents: number;
  fiat_currency: string;
  expires_at: null;
  pay_url: null;
}

export interface VerifyPaymentData {
  transaction_id: string;
  status: "pending" | "completed" | "expired" | "failed";
  amount_cents: number;
  currency: string;
  completed_at?: string | null;
  address?: string | null;
  pay_currency?: string | null;
}
