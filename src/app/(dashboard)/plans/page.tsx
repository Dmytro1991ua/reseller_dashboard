import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { flashproxyFetch } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import type { PlansListData, PlanStatus } from "@/types/api";
import { PlansToolbar } from "@/features/plans/components/PlansToolbar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plans" };

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
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  provisioning: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  inactive: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  expired: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const PER_PAGE = 20;

// ─── pagination helpers ───────────────────────────────────────────────────────

function buildPageUrl(newPage: number, currentParams: Record<string, string | string[]>) {
  const params = new URLSearchParams();
  Object.entries(currentParams).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach((s) => params.append(k, s));
    else if (v) params.set(k, v);
  });
  if (newPage > 1) params.set("page", String(newPage));
  else params.delete("page");
  const qs = params.toString();
  return qs ? `/plans?${qs}` : "/plans";
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function PlansPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}>) {
  const { page: pageParam, status, search } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1));

  const session = await getSession();
  const apiKey = session.apiKey ?? "";

  const data = await flashproxyFetch<PlansListData>(apiKey, "/plans", {
    searchParams: {
      page,
      per_page: PER_PAGE,
      ...(status ? { status } : {}),
      ...(search ? { search } : {}),
      sort: "created_at",
      order: "desc",
    },
    revalidate: 60,
  }).catch(() => null);

  const plans = data?.plans ?? [];

  const pagination = data?.pagination;
  const totalPages = pagination?.total_pages ?? 1;
  const total = pagination?.total ?? 0;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const currentParams = {
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <PlansToolbar />
        <Link href="/plans/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="size-4" />
          New Plan
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Status</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Plan ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-12 text-center">
                    {search || status ? "No plans match your filters." : "No plans yet."}
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.plan_id}>
                    <TableCell className="pl-4">
                      <span
                        className={cn(
                          "inline-flex rounded px-1.5 py-0.5 text-xs font-medium capitalize",
                          STATUS_CLASS[plan.status],
                        )}
                      >
                        {plan.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {PRODUCT_LABELS[plan.product] ?? plan.product}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {plan.plan_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(plan.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {plan.expires_at ? formatDate(plan.expires_at) : "No expiry"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {plan.purchase_price_cents ? formatUSD(plan.purchase_price_cents) : "—"}
                    </TableCell>
                    <TableCell className="pr-4">
                      <Link
                        href={`/plans/${plan.plan_id}`}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="View plan details"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination — always visible */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page} of {Math.max(1, totalPages)} &middot; {total} plan{total === 1 ? "" : "s"}{" "}
          total
        </span>
        <div className="flex gap-2">
          {hasPrev ? (
            <Link
              href={buildPageUrl(page - 1, currentParams)}
              className="hover:bg-muted rounded-md border px-3 py-1.5 transition-colors"
            >
              ← Previous
            </Link>
          ) : (
            <span className="text-muted-foreground cursor-not-allowed rounded-md border px-3 py-1.5 opacity-40">
              ← Previous
            </span>
          )}
          {hasNext ? (
            <Link
              href={buildPageUrl(page + 1, currentParams)}
              className="hover:bg-muted rounded-md border px-3 py-1.5 transition-colors"
            >
              Next →
            </Link>
          ) : (
            <span className="text-muted-foreground cursor-not-allowed rounded-md border px-3 py-1.5 opacity-40">
              Next →
            </span>
          )}
        </div>
      </div>
    </>
  );
}
