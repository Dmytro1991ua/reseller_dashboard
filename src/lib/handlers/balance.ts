import { db } from "@/lib/db";
import { formatUSD } from "@/lib/pricing";
import type { HandlerResult } from "@/lib/router";

export async function directTopup(body: unknown): Promise<HandlerResult> {
  const { amount_cents } = body as { amount_cents?: number };
  if (!amount_cents || !Number.isInteger(amount_cents) || amount_cents <= 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "amount_cents must be a positive integer" },
      },
    };
  }

  let balance = await db.balance.findFirst();
  if (!balance) {
    balance = await db.balance.create({ data: { balanceCents: 0, totalSpentCents: 0 } });
  }

  const newBalance = balance.balanceCents + amount_cents;

  await db.$transaction([
    db.balance.update({ where: { id: balance.id }, data: { balanceCents: newBalance } }),
    db.transaction.create({
      data: {
        type: "topup",
        amountCents: amount_cents,
        description: `Admin top-up — ${formatUSD(amount_cents)}`,
        balanceAfterCents: newBalance,
      },
    }),
  ]);

  return {
    status: 200,
    body: {
      success: true,
      data: {
        balance_cents: newBalance,
        balance_formatted: formatUSD(newBalance),
        added_cents: amount_cents,
        added_formatted: formatUSD(amount_cents),
      },
    },
  };
}

export async function getBalance(): Promise<HandlerResult> {
  let balance = await db.balance.findFirst();
  if (!balance) {
    balance = await db.balance.create({ data: { balanceCents: 100000, totalSpentCents: 0 } });
  }
  return {
    status: 200,
    body: {
      success: true,
      data: {
        balance_cents: balance.balanceCents,
        balance_formatted: formatUSD(balance.balanceCents),
        allocations: {},
        total_spent_cents: balance.totalSpentCents,
        total_spent_formatted: formatUSD(balance.totalSpentCents),
      },
    },
  };
}

export async function getTransactions(search: URLSearchParams): Promise<HandlerResult> {
  const page = Math.max(1, Number(search.get("page") ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(search.get("per_page") ?? 20)));
  const type = search.get("type");

  const where = type && type !== "all" ? { type } : {};
  const total = await db.transaction.count({ where });
  const items = await db.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        transactions: items.map((t) => ({
          id: t.id,
          type: t.type,
          amount_cents: t.amountCents,
          amount_formatted: formatUSD(t.amountCents),
          description: t.description,
          plan_id: t.planId ?? null,
          balance_after_cents: t.balanceAfterCents,
          created_at: t.createdAt.toISOString(),
        })),
        pagination: {
          page,
          per_page: perPage,
          total,
          total_pages: Math.max(1, Math.ceil(total / perPage)),
        },
      },
    },
  };
}

export async function getPricing(): Promise<HandlerResult> {
  const { PRICING_TABLE } = await import("@/lib/pricing");
  return { status: 200, body: { success: true, data: PRICING_TABLE } };
}

export async function createCryptoTopup(body: unknown): Promise<HandlerResult> {
  const b = body as { amount_cents?: number; currency?: string; network?: string };
  return {
    status: 200,
    body: {
      success: true,
      data: {
        tracking_id: `WAL_${Math.random().toString(36).slice(2, 14)}`,
        address: "TXyz9ABCdefGHIjklMNOpqrsTUVwxYZ_sandbox",
        amount_crypto: null,
        currency: b.currency ?? "USDT",
        network: b.network ?? "TRON",
        amount_usd_cents: b.amount_cents ?? 5000,
        fiat_currency: "USD",
        expires_at: null,
        pay_url: null,
      },
    },
  };
}

export async function verifyPayment(trackingId: string): Promise<HandlerResult> {
  return {
    status: 200,
    body: {
      success: true,
      data: {
        transaction_id: trackingId,
        status: "pending",
        amount_cents: 0,
        currency: "USD",
        address: "TXyz9ABCdefGHIjklMNOpqrsTUVwxYZ_sandbox",
        pay_currency: "USDT_TRON",
      },
    },
  };
}

function seededRand(base: number, index: number): number {
  let h = (base + index * 2654435761) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

export async function getUsageSummary(search: URLSearchParams): Promise<HandlerResult> {
  const period = search.get("period") ?? "month";
  const plans = await db.plan.findMany({ where: { status: "active" } });

  const byProduct: Record<string, { bytes: number; plans: number }> = {};
  let totalBytes = 0;
  for (const p of plans) {
    const bytes = Number(p.bytesUsed);
    totalBytes += bytes;
    if (!byProduct[p.product]) byProduct[p.product] = { bytes: 0, plans: 0 };
    byProduct[p.product].bytes += bytes;
    byProduct[p.product].plans += 1;
  }

  const days = period === "week" ? 7 : 30;
  const now = Date.now();
  const periodMs = days * 86400 * 1000;

  // Build synthetic daily breakdown distributed across the period
  const daily_breakdown: Array<{ date: string; gb: number; bytes: number }> = [];
  const seed = Math.floor(totalBytes / 1e5) + 1;
  const weights = Array.from({ length: days }, (_, i) => {
    const recencyBias = 0.4 + 0.6 * (i / Math.max(days - 1, 1));
    return recencyBias * (0.3 + 0.7 * seededRand(seed, i));
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const date = d.toISOString().slice(0, 10);
    const dayBytes = totalBytes > 0 ? Math.floor((weights[i] / weightSum) * totalBytes) : 0;
    daily_breakdown.push({ date, bytes: dayBytes, gb: +(dayBytes / 1e9).toFixed(3) });
  }

  return {
    status: 200,
    body: {
      success: true,
      data: {
        time_range: { start: now - periodMs, end: now, period },
        summary: {
          total_bytes: totalBytes,
          total_gb: +(totalBytes / 1e9).toFixed(3),
          total_requests: plans.length * 50,
          active_plans: plans.length,
        },
        by_product: byProduct,
        daily_breakdown,
      },
    },
  };
}
