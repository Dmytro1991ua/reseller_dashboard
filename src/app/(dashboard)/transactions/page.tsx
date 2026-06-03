import type { Metadata } from "next";
import Link from "next/link";
import { flashproxyFetch } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import type { TransactionsData, Transaction } from "@/types/api";
import { TransactionsToolbar } from "@/features/transactions/components/TransactionsToolbar";
import { Badge } from "@/components/ui/badge";
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

export const metadata: Metadata = { title: "Transactions" };

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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

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

const PER_PAGE = 20;

// ─── pagination helper ────────────────────────────────────────────────────────

function buildPageUrl(newPage: number, currentParams: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(currentParams).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  if (newPage > 1) params.set("page", String(newPage));
  else params.delete("page");
  const qs = params.toString();
  return qs ? `/transactions?${qs}` : "/transactions";
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function TransactionsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ page?: string; type?: string }>;
}>) {
  const { page: pageParam, type } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1));

  const session = await getSession();
  const apiKey = session.apiKey ?? "";

  const data = await flashproxyFetch<TransactionsData>(apiKey, "/balance/transactions", {
    searchParams: {
      page,
      per_page: PER_PAGE,
      ...(type ? { type } : {}),
    },
    revalidate: 30,
  }).catch(() => null);

  const transactions = data?.transactions ?? [];
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.total_pages ?? 1;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const currentParams = { ...(type ? { type } : {}) };

  return (
    <>
      <div className="border-b-2 pb-2">
        <h1 className="text-2xl font-bold">Transactions</h1>
      </div>

      <TransactionsToolbar />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="pr-4 text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-12 text-center">
                    {type ? "No transactions match this filter." : "No transactions yet."}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="pl-4">
                      <Badge
                        variant={tx.amount_cents > 0 ? "default" : "secondary"}
                        className="min-w-18 justify-center"
                      >
                        {TX_LABELS[tx.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm">{tx.description}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {tx.plan_id ? (
                        <Link
                          href={`/plans/${tx.plan_id}`}
                          className="hover:text-foreground transition-colors"
                        >
                          {tx.plan_id.slice(0, 8)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          tx.amount_cents > 0 ? "text-green-600 dark:text-green-400" : "",
                        )}
                      >
                        {tx.amount_formatted ?? formatUSD(tx.amount_cents)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground pr-4 text-right text-xs">
                      {formatDate(tx.created_at)}
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
          Page {page} of {Math.max(1, totalPages)} &middot; {total} transaction
          {total === 1 ? "" : "s"} total
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
