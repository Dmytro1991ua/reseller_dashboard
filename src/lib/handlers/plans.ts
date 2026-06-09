import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { computePrice, CONNECTION_INFO, DURATION_DAYS, formatUSD } from "@/lib/pricing";
import type { HandlerResult } from "@/lib/router";
import type { CreatePlanRequest } from "@/types/api";

function randomStr(len: number) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(
    "",
  );
}

function planToApi(p: {
  planId: string;
  product: string;
  billingType: string;
  proxyUsername: string;
  proxyPassword: string;
  hostname: string;
  portHttp: number;
  portSocks: number | null;
  connectionFormat: string;
  status: string;
  bytesUsed: bigint;
  maxGb: number | null;
  maxBytes: bigint | null;
  maxMbps: number | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  purchasePriceCents: number | null;
  endUserReference: string | null;
  allowedIps: string;
  pool: string | null;
  quantity: number | null;
  proxyList: string | null;
  location: string | null;
}) {
  return {
    plan_id: p.planId,
    product: p.product,
    billing_type: p.billingType,
    proxy_username: p.proxyUsername,
    proxy_password: p.proxyPassword,
    connection: {
      hostname: p.hostname,
      port_http: p.portHttp,
      port_socks: p.portSocks,
      format: p.connectionFormat,
    },
    limits: {
      max_gb: p.maxGb,
      max_bytes: p.maxBytes ? Number(p.maxBytes) : null,
      bytes_used: Number(p.bytesUsed),
      max_mbps: p.maxMbps,
    },
    location: p.location,
    expires_at: p.expiresAt?.toISOString() ?? null,
    status: p.status,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
    purchase_price_cents: p.purchasePriceCents,
    end_user_reference: p.endUserReference,
    allowed_ips: JSON.parse(p.allowedIps) as string[],
    pool: p.pool,
    quantity: p.quantity,
    proxy_list: p.proxyList ? JSON.parse(p.proxyList) : null,
  };
}

export async function listPlans(search: URLSearchParams): Promise<HandlerResult> {
  const page = Math.max(1, Number(search.get("page") ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(search.get("per_page") ?? 20)));
  const status = search.get("status");
  const product = search.get("product");
  const searchQ = search.get("search");
  const sort = (search.get("sort") ?? "created_at") as "createdAt" | "expiresAt" | "updatedAt";
  const order = (search.get("order") ?? "desc") as "asc" | "desc";

  const sortMap: Record<string, string> = {
    created_at: "createdAt",
    expires_at: "expiresAt",
    updated_at: "updatedAt",
  };

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (product) where.product = product;
  if (searchQ) {
    where.OR = [
      { planId: { contains: searchQ } },
      { proxyUsername: { contains: searchQ } },
      { endUserReference: { contains: searchQ } },
    ];
  }

  const total = await db.plan.count({ where });
  const items = await db.plan.findMany({
    where,
    orderBy: { [sortMap[sort] ?? "createdAt"]: order },
    skip: (page - 1) * perPage,
    take: perPage,
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        plans: items.map(planToApi),
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

export async function getPlan(planId: string): Promise<HandlerResult> {
  const plan = await db.plan.findUnique({ where: { planId } });
  if (!plan) {
    return {
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "Plan not found" } },
    };
  }
  return { status: 200, body: { success: true, data: planToApi(plan) } };
}

export async function createPlan(body: unknown): Promise<HandlerResult> {
  const req = body as CreatePlanRequest;

  let price: ReturnType<typeof computePrice>;
  try {
    price = computePrice(req);
  } catch {
    return {
      status: 400,
      body: {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid plan parameters" },
      },
    };
  }

  const balance = await db.balance.findFirst();
  const currentBalance = balance?.balanceCents ?? 0;
  if (currentBalance < price.cost_cents) {
    return {
      status: 402,
      body: {
        success: false,
        error: {
          code: "INSUFFICIENT_BALANCE",
          message: `Insufficient balance. Required: ${formatUSD(price.cost_cents)}, Available: ${formatUSD(currentBalance)}`,
        },
      },
    };
  }

  const conn = CONNECTION_INFO[req.product] ?? CONNECTION_INFO["residential-lite"];
  const planId = randomUUID();
  const username = randomStr(8);
  const password = randomStr(8);
  const connFormat = `${username}:${password}@${conn.hostname}:${conn.port_http}`;

  let billingType = "bandwidth";
  let maxGb: number | null = req.bandwidth_gb ?? null;
  let maxBytes: bigint | null = maxGb ? BigInt(Math.floor(maxGb * 1e9)) : null;
  let maxMbps: number | null = null;
  let expiresAt: Date | null = null;

  if (req.duration && req.duration !== "trial") {
    const days = DURATION_DAYS[req.duration] ?? 30;
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  if (req.duration === "trial") {
    expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    billingType = "time";
    maxMbps = 200;
    maxGb = null;
    maxBytes = null;
  }
  if (req.billing_type === "time") {
    billingType = "time";
    maxMbps = req.mbps ?? req.bandwidth_mbps ?? 100;
    maxGb = null;
    maxBytes = null;
  }
  if (req.product === "unlimited_residential") {
    billingType = "time";
    maxMbps = req.bandwidth_mbps ?? 200;
    maxGb = null;
    maxBytes = null;
  }
  if (req.product === "dedicated_isp") {
    billingType = "per_ip";
    maxGb = null;
    maxBytes = null;
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  let proxyList = null;
  if (req.product === "dedicated_isp") {
    const qty = req.quantity ?? 1;
    const ips = Array.from({ length: qty }, (_, i) => {
      const host = `192.168.${100 + i}.${Math.floor(Math.random() * 200) + 10}`;
      return {
        host,
        port: 61234,
        username,
        password,
        full: `${host}:61234:${username}:${password}`,
      };
    });
    proxyList = JSON.stringify(ips);
  }

  const newBalance = currentBalance - price.cost_cents;

  const [plan] = await db.$transaction([
    db.plan.create({
      data: {
        planId,
        product: req.product,
        billingType,
        proxyUsername: username,
        proxyPassword: password,
        hostname: conn.hostname,
        portHttp: conn.port_http,
        portSocks: conn.port_socks,
        connectionFormat: connFormat,
        maxGb,
        maxBytes,
        maxMbps,
        expiresAt,
        purchasePriceCents: price.cost_cents,
        endUserReference: req.end_user_reference ?? null,
        allowedIps: JSON.stringify(req.allowed_ips ?? []),
        pool: req.pool ?? null,
        quantity: req.quantity ?? null,
        proxyList,
        location: req.location ?? null,
      },
    }),
    db.transaction.create({
      data: {
        type: "purchase",
        amountCents: -price.cost_cents,
        description: `${req.product}${maxGb ? ` - ${maxGb}GB` : ""}${maxMbps ? ` - ${maxMbps}Mbps` : ""}`,
        planId,
        balanceAfterCents: newBalance,
      },
    }),
    db.balance.update({
      where: { id: balance!.id },
      data: {
        balanceCents: newBalance,
        totalSpentCents: { increment: price.cost_cents },
      },
    }),
  ]);

  return { status: 201, body: { success: true, data: planToApi(plan) } };
}

export async function cancelPlan(planId: string): Promise<HandlerResult> {
  const plan = await db.plan.findUnique({ where: { planId } });
  if (!plan) {
    return {
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "Plan not found" } },
    };
  }
  if (plan.status === "cancelled") {
    return {
      status: 400,
      body: {
        success: false,
        error: { code: "ALREADY_CANCELLED", message: "Plan already cancelled" },
      },
    };
  }

  // Calculate proportional refund based on remaining value
  const purchasePrice = plan.purchasePriceCents ?? 0;
  let refundCents = 0;
  if (purchasePrice > 0) {
    if (plan.billingType === "bandwidth" && plan.maxBytes && plan.maxBytes > 0n) {
      const usedFraction = Math.min(1, Number(plan.bytesUsed) / Number(plan.maxBytes));
      refundCents = Math.floor(purchasePrice * (1 - usedFraction));
    } else if ((plan.billingType === "time" || plan.billingType === "per_ip") && plan.expiresAt) {
      const now = Date.now();
      if (plan.expiresAt.getTime() > now) {
        const totalDuration = plan.expiresAt.getTime() - plan.createdAt.getTime();
        const elapsed = now - plan.createdAt.getTime();
        const remainingFraction = Math.max(0, 1 - elapsed / totalDuration);
        refundCents = Math.floor(purchasePrice * remainingFraction);
      }
    }
  }

  const balance = await db.balance.findFirst();
  const currentBalance = balance?.balanceCents ?? 0;
  const newBalance = currentBalance + refundCents;

  if (refundCents > 0 && balance) {
    await db.$transaction([
      db.plan.update({ where: { planId }, data: { status: "cancelled" } }),
      db.transaction.create({
        data: {
          type: "refund",
          amountCents: refundCents,
          description:
            "Cancellation refund — " + plan.product + " (" + formatUSD(refundCents) + ")",
          planId,
          balanceAfterCents: newBalance,
        },
      }),
      db.balance.update({
        where: { id: balance.id },
        data: { balanceCents: newBalance, totalSpentCents: { decrement: refundCents } },
      }),
    ]);
  } else {
    await db.plan.update({ where: { planId }, data: { status: "cancelled" } });
  }

  return {
    status: 200,
    body: {
      success: true,
      data: {
        plan_id: planId,
        status: "cancelled",
        message:
          refundCents > 0
            ? `Plan cancelled. ${formatUSD(refundCents)} refunded to your balance.`
            : "Plan cancelled. No refund (no remaining value).",
        refund_cents: refundCents,
        refund_formatted: formatUSD(refundCents),
        cancelled_at: new Date().toISOString(),
      },
    },
  };
}

export async function extendPlan(planId: string, body: unknown): Promise<HandlerResult> {
  const req = body as {
    add_bandwidth_gb?: number;
    add_days?: number;
    extend_30_days?: boolean;
  };
  const plan = await db.plan.findUnique({ where: { planId } });
  if (!plan) {
    return {
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "Plan not found" } },
    };
  }

  const balance = await db.balance.findFirst();
  const currentBalance = balance?.balanceCents ?? 0;

  if (req.add_bandwidth_gb) {
    const { PRICING_TABLE } = await import("@/lib/pricing");
    const pricing = PRICING_TABLE[plan.product];
    const costCents = Math.ceil(req.add_bandwidth_gb * (pricing?.price_per_gb ?? 50));
    if (currentBalance < costCents) {
      return {
        status: 402,
        body: {
          success: false,
          error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient balance" },
        },
      };
    }
    const addBytes = BigInt(Math.floor(req.add_bandwidth_gb * 1e9));
    const newMaxBytes = (plan.maxBytes ?? 0n) + addBytes;
    const newBalance = currentBalance - costCents;
    await db.$transaction([
      db.plan.update({
        where: { planId },
        data: { maxBytes: newMaxBytes, maxGb: Number(newMaxBytes) / 1e9 },
      }),
      db.transaction.create({
        data: {
          type: "extend",
          amountCents: -costCents,
          description: `${plan.product} - +${req.add_bandwidth_gb}GB`,
          planId,
          balanceAfterCents: newBalance,
        },
      }),
      db.balance.update({
        where: { id: balance!.id },
        data: { balanceCents: newBalance, totalSpentCents: { increment: costCents } },
      }),
    ]);
    return {
      status: 200,
      body: {
        success: true,
        data: {
          plan_id: planId,
          cost_cents: costCents,
          cost_formatted: formatUSD(costCents),
          gb_added: req.add_bandwidth_gb,
          new_max_bytes: Number(newMaxBytes),
        },
      },
    };
  }

  if (req.add_days || req.extend_30_days) {
    const days = req.extend_30_days ? 30 : (req.add_days ?? 1);
    const { PRICING_TABLE } = await import("@/lib/pricing");
    const pricing = PRICING_TABLE[plan.product];
    const costCents = Math.ceil(days * (pricing?.price_per_day_cents ?? 200));
    if (currentBalance < costCents) {
      return {
        status: 402,
        body: {
          success: false,
          error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient balance" },
        },
      };
    }
    const base = plan.expiresAt ? plan.expiresAt.getTime() : Date.now();
    const newExpiry = new Date(base + days * 24 * 60 * 60 * 1000);
    const newBalance = currentBalance - costCents;
    await db.$transaction([
      db.plan.update({ where: { planId }, data: { expiresAt: newExpiry } }),
      db.transaction.create({
        data: {
          type: "extend",
          amountCents: -costCents,
          description: `${plan.product} - +${days} days`,
          planId,
          balanceAfterCents: newBalance,
        },
      }),
      db.balance.update({
        where: { id: balance!.id },
        data: { balanceCents: newBalance, totalSpentCents: { increment: costCents } },
      }),
    ]);
    return {
      status: 200,
      body: {
        success: true,
        data: {
          plan_id: planId,
          cost_cents: costCents,
          cost_formatted: formatUSD(costCents),
          days_added: days,
          new_expires_at: newExpiry.toISOString(),
        },
      },
    };
  }

  return {
    status: 400,
    body: {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Provide add_bandwidth_gb, add_days, or extend_30_days",
      },
    },
  };
}

export async function updatePassword(planId: string, body: unknown): Promise<HandlerResult> {
  const { new_password } = body as { new_password?: string };
  if (!new_password || new_password.length < 6) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Password must be 6-32 alphanumeric characters",
        },
      },
    };
  }
  const plan = await db.plan.findUnique({ where: { planId } });
  if (!plan) {
    return {
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "Plan not found" } },
    };
  }
  const conn = `${plan.proxyUsername}:${new_password}@${plan.hostname}:${plan.portHttp}`;
  await db.plan.update({
    where: { planId },
    data: { proxyPassword: new_password, connectionFormat: conn },
  });
  return {
    status: 200,
    body: {
      success: true,
      data: {
        plan_id: planId,
        proxy_username: plan.proxyUsername,
        proxy_password: new_password,
        message: "Password updated successfully",
      },
    },
  };
}

export async function updateAllowedIps(planId: string, body: unknown): Promise<HandlerResult> {
  const { allowed_ips } = body as { allowed_ips?: string[] };
  if (!Array.isArray(allowed_ips) || allowed_ips.length > 10) {
    return {
      status: 400,
      body: {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "allowed_ips must be an array of max 10 IPs" },
      },
    };
  }
  const plan = await db.plan.findUnique({ where: { planId } });
  if (!plan) {
    return {
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "Plan not found" } },
    };
  }
  await db.plan.update({ where: { planId }, data: { allowedIps: JSON.stringify(allowed_ips) } });
  return {
    status: 200,
    body: {
      success: true,
      data: { plan_id: planId, allowed_ips, updated_at: new Date().toISOString() },
    },
  };
}

export async function getPlanProxies(planId: string): Promise<HandlerResult> {
  const plan = await db.plan.findUnique({ where: { planId } });
  if (!plan) {
    return {
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "Plan not found" } },
    };
  }

  // dedicated_isp plans have an explicit proxy list; all other plans expose their single connection entry
  const proxies: Array<{
    host: string;
    port: number;
    username: string;
    password: string;
    full: string;
  }> = plan.proxyList
    ? (JSON.parse(plan.proxyList) as typeof proxies)
    : [
        {
          host: plan.hostname,
          port: plan.portHttp,
          username: plan.proxyUsername,
          password: plan.proxyPassword,
          full:
            plan.hostname +
            ":" +
            plan.portHttp +
            ":" +
            plan.proxyUsername +
            ":" +
            plan.proxyPassword,
        },
      ];

  return {
    status: 200,
    body: {
      success: true,
      data: {
        plan_id: planId,
        count: proxies.length,
        proxies,
        pool: plan.pool,
        expires_at:
          plan.expiresAt?.toISOString() ??
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        source: plan.proxyList ? "provider" : "credentials",
      },
    },
  };
}

export async function checkPriceHandler(body: unknown): Promise<HandlerResult> {
  try {
    const result = computePrice(body as CreatePlanRequest);
    return { status: 200, body: { success: true, data: result } };
  } catch {
    return {
      status: 400,
      body: {
        success: false,
        error: { code: "PRICING_ERROR", message: "Unable to calculate price" },
      },
    };
  }
}
