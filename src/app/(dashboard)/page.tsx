import type { Metadata } from "next";
import Link from "next/link";
import { flashproxyFetch } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import type {
  Balance,
  PlansListData,
  TransactionsData,
  PlanStatus,
  Transaction,
} from "@/types/api";
import { StatCard } from "@/features/overview/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  provisioning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  inactive: "bg-secondary text-secondary-foreground",
  expired: "bg-secondary text-secondary-foreground",
  cancelled: "bg-secondary text-secondary-foreground",
  failed: "bg-destructive/10 text-destructive",
};

const TX_LABELS: Record<Transaction["type"], string> = {
  topup: "Top-up",
  purchase: "Purchase",
  extend: "Extend",
  refund: "Refund",
  adjustment: "Adjustment",
  allocation_usage: "Usage",
  manual_refund: "Refund",
  plan_creation: "Plan",
  plan_extension: "Extension",
  admin_credit: "Credit",
  admin_debit: "Debit",
  admin_adjustment: "Adjustment",
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function OverviewPage() {
  const session = await getSession();
  const apiKey = session.apiKey ?? "";

  const [balanceResult, plansResult, txResult] = await Promise.allSettled([
    flashproxyFetch<Balance>(apiKey, "/balance", { revalidate: 30 }),
    flashproxyFetch<PlansListData>(apiKey, "/plans", {
      searchParams: { per_page: 5, sort: "created_at", order: "desc" },
      revalidate: 60,
    }),
    flashproxyFetch<TransactionsData>(apiKey, "/balance/transactions", {
      searchParams: { per_page: 5 },
      revalidate: 30,
    }),
  ]);

  const balance = balanceResult.status === "fulfilled" ? balanceResult.value : null;
  const plansData = plansResult.status === "fulfilled" ? plansResult.value : null;
  const txData = txResult.status === "fulfilled" ? txResult.value : null;

  return (
    <>
      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Balance"
          value={balance ? formatUSD(balance.balance_cents) : "—"}
          subtitle="available credit"
        />
        <StatCard
          title="Total Spent"
          value={balance ? formatUSD(balance.total_spent_cents) : "—"}
          subtitle="all time"
        />
        <StatCard
          title="Total Plans"
          value={plansData ? String(plansData.pagination.total) : "—"}
          subtitle="all statuses"
        />
        <StatCard
          title="Transactions"
          value={txData ? String(txData.pagination.total) : "—"}
          subtitle="all time"
        />
      </div>

      {/* ── Plans preview + recent transactions ─────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-7">
        {/* Recent plans */}
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Plans</CardTitle>
            <Link
              href="/plans"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {plansData && plansData.plans.length > 0 ? (
              <div className="space-y-1">
                {plansData.plans.map((plan) => (
                  <Link
                    key={plan.plan_id}
                    href={`/plans/${plan.plan_id}`}
                    className="hover:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors"
                  >
                    <span
                      className={cn(
                        "inline-flex shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                        STATUS_CLASS[plan.status],
                      )}
                    >
                      {plan.status}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {PRODUCT_LABELS[plan.product] ?? plan.product}
                    </span>
                    <span className="text-muted-foreground shrink-0 font-mono text-xs">
                      {plan.plan_id.slice(0, 8)}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {plan.expires_at ? formatDate(plan.expires_at) : "No expiry"}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">No plans yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link
              href="/transactions"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {txData && txData.transactions.length > 0 ? (
              <div className="space-y-3">
                {txData.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-start gap-3">
                    <Badge
                      variant={tx.amount_cents > 0 ? "default" : "secondary"}
                      className="mt-0.5 shrink-0"
                    >
                      {TX_LABELS[tx.type]}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{tx.description}</p>
                      <p className="text-muted-foreground text-xs">{relativeTime(tx.created_at)}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-medium tabular-nums",
                        tx.amount_cents > 0 ? "text-green-600 dark:text-green-400" : "",
                      )}
                    >
                      {tx.amount_formatted ?? formatUSD(tx.amount_cents)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">No transactions yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
