import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { dbFetch } from "@/lib/dbFetch";
import type { Plan, PlanStatus, MetricsSummary } from "@/types/api";
import { PlanCredentials } from "@/features/plans/components/PlanCredentials";
import { PlanActions } from "@/features/plans/components/PlanActions";
import { PlanProxyDownload } from "@/features/plans/components/PlanProxyDownload";
import { PlanMetricsCharts } from "@/features/plans/components/PlanMetricsCharts";
import { PlanInvestigation } from "@/features/plans/components/PlanInvestigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan Detail" };

function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

const PRODUCT_LABELS: Record<string, string> = {
  "residential-lite": "Residential Lite",
  residential: "Residential",
  mobile: "Mobile",
  mobile_usa: "Mobile USA",
  datacenter: "Datacenter",
  shared_isp: "Shared ISP",
  "ipv6-residential": "IPv6 Residential",
  "ipv6-datacenter": "IPv6 Datacenter",
  unlimited_residential: "Unlimited Residential",
  dedicated_isp: "Dedicated ISP",
  pool1: "Pool 1",
  pool2: "Pool 2",
  pool3: "Pool 3",
  pool4: "Pool 4",
  pool5: "Pool 5",
};

const STATUS_CLASS: Record<PlanStatus, string> = {
  active: "bg-green-300 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  provisioning: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  inactive: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  expired: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const BILLING_LABELS: Record<string, string> = {
  bandwidth: "Bandwidth",
  time: "Time-based",
  per_ip: "Per IP",
};

const METRICS_PRODUCTS = new Set([
  "datacenter",
  "shared_isp",
  "ipv6-datacenter",
  "ipv6-residential",
]);

function InfoRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="min-w-0 flex-1 text-right font-medium">{value}</span>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: Readonly<{ title: string; value: string; subtitle?: string }>) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {subtitle && <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

async function fetchPlan(planId: string): Promise<Plan | null> {
  return dbFetch<Plan>(`/plans/${planId}`).catch(() => null);
}

async function fetchMetrics(planId: string): Promise<MetricsSummary | null> {
  return dbFetch<MetricsSummary>(`/plans/${planId}/metrics/summary?hours=24`).catch(() => null);
}

interface MetricsTabProps {
  hasMetrics: boolean;
  metrics: MetricsSummary | null;
}

function MetricsTabContent({ hasMetrics, metrics }: Readonly<MetricsTabProps>) {
  if (!hasMetrics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">
            Metrics are not available for this plan type.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (metrics === null) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No metrics data available for the last 24 hours.
          </p>
        </CardContent>
      </Card>
    );
  }

  const successRate =
    metrics.success_rate_pct === null ? "—" : `${metrics.success_rate_pct.toFixed(1)}%`;

  return (
    <>
      <p className="text-muted-foreground text-sm">Last {metrics.hours} hours</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Traffic" value={formatBytes(metrics.total_bytes)} />
        <StatCard title="Connections" value={metrics.total_connections.toLocaleString()} />
        <StatCard title="Success Rate" value={successRate} />
        <StatCard title="Errors" value={metrics.total_errors.toLocaleString()} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Peak Concurrent"
          value={String(metrics.peak_concurrent)}
          subtitle="simultaneous connections"
        />
        <StatCard title="Avg Throughput" value={`${metrics.avg_mbps.toFixed(2)} Mbps`} />
        <StatCard title="Peak Throughput" value={`${metrics.peak_mbps.toFixed(2)} Mbps`} />
      </div>
    </>
  );
}

export default async function PlanDetailPage({
  params,
}: Readonly<{
  params: Promise<{ planId: string }>;
}>) {
  const { planId } = await params;

  const plan = await fetchPlan(planId);
  if (!plan) notFound();

  const { bytes_used, max_bytes, max_gb } = plan.limits;
  const usagePercent = max_bytes ? Math.min(100, (bytes_used / max_bytes) * 100) : null;
  const hasMetrics = METRICS_PRODUCTS.has(plan.product);
  const metrics = hasMetrics ? await fetchMetrics(planId) : null;

  return (
    <>
      {/* ── Back link + header ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <Link
          href="/plans"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" /> Back to Plans
        </Link>

        <div className="between flex items-start justify-between border-b-2 pb-2">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{PRODUCT_LABELS[plan.product] ?? plan.product}</h1>
              <span
                className={cn(
                  "inline-flex rounded px-2 py-0.5 text-sm font-medium capitalize",
                  STATUS_CLASS[plan.status],
                )}
              >
                {plan.status}
              </span>
            </div>
            <p className="text-muted-foreground font-mono text-sm">{plan.plan_id}</p>
          </div>
          <PlanActions plan={plan} />
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Cost"
              value={plan.purchase_price_cents ? formatUSD(plan.purchase_price_cents) : "—"}
              subtitle="purchase price"
            />
            <StatCard
              title="Expires"
              value={plan.expires_at ? formatDate(plan.expires_at) : "No expiry"}
            />
            <StatCard
              title="Billing"
              value={BILLING_LABELS[plan.billing_type] ?? plan.billing_type}
            />
          </div>

          {/* Bandwidth usage */}
          {max_bytes != null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bandwidth Usage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{formatBytes(bytes_used)} used</span>
                  <span className="text-muted-foreground">
                    {max_gb == null ? formatBytes(max_bytes) : `${max_gb} GB`} total
                  </span>
                </div>
                <Progress value={usagePercent ?? 0} />
                <p className="text-muted-foreground text-xs">
                  {(usagePercent ?? 0).toFixed(1)}% of allocation used
                </p>
              </CardContent>
            </Card>
          )}

          {/* Connection info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connection Info</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow label="Hostname" value={plan.connection.hostname} />
              <InfoRow label="HTTP Port" value={String(plan.connection.port_http)} />
              {plan.connection.port_socks != null && (
                <InfoRow label="SOCKS Port" value={String(plan.connection.port_socks)} />
              )}
              {plan.location && <InfoRow label="Location" value={plan.location} />}
              <InfoRow label="Created" value={formatDate(plan.created_at)} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Credentials ──────────────────────────────────────────────── */}
        <TabsContent value="credentials" className="mt-4 space-y-4">
          <PlanCredentials plan={plan} />
          <PlanProxyDownload plan={plan} />
        </TabsContent>

        {/* ── Metrics ──────────────────────────────────────────────────── */}
        <TabsContent value="metrics" className="mt-4 space-y-4">
          <MetricsTabContent hasMetrics={hasMetrics} metrics={metrics} />
          {hasMetrics && <PlanMetricsCharts planId={planId} />}
          {hasMetrics && <PlanInvestigation planId={planId} />}
        </TabsContent>
      </Tabs>
    </>
  );
}
