import { db } from "@/lib/db";
import { formatUSD } from "@/lib/pricing";
import type { HandlerResult } from "@/lib/router";

function toApi(u: {
  id: string;
  email: string;
  name: string;
  status: string;
  balanceCents: number;
  plansCount: number;
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    status: u.status,
    balance_cents: u.balanceCents,
    balance_formatted: formatUSD(u.balanceCents),
    plans_count: u.plansCount,
    created_at: u.createdAt.toISOString(),
  };
}

export async function listSubUsers(search: URLSearchParams): Promise<HandlerResult> {
  const page = Math.max(1, Number(search.get("page") ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(search.get("per_page") ?? 20)));
  const status = search.get("status");

  const where = status && status !== "all" ? { status } : {};
  const total = await db.subUser.count({ where });
  const items = await db.subUser.findMany({
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
        items: items.map(toApi),
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

export async function createSubUser(body: unknown): Promise<HandlerResult> {
  const { email, name, initial_balance_cents } = body as {
    email?: string;
    name?: string;
    initial_balance_cents?: number;
  };

  if (!email || !name) {
    return {
      status: 400,
      body: {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "email and name are required" },
      },
    };
  }

  const existing = await db.subUser.findUnique({ where: { email } });
  if (existing) {
    return {
      status: 400,
      body: {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Email already in use" },
      },
    };
  }

  const balanceCents = initial_balance_cents ?? 0;

  if (balanceCents > 0) {
    const balance = await db.balance.findFirst();
    if (!balance || balance.balanceCents < balanceCents) {
      return {
        status: 402,
        body: {
          success: false,
          error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient balance" },
        },
      };
    }
    await db.balance.update({
      where: { id: balance.id },
      data: { balanceCents: { decrement: balanceCents } },
    });
  }

  const user = await db.subUser.create({ data: { email, name, balanceCents } });

  return {
    status: 201,
    body: { success: true, data: { ...toApi(user), api_key: `fp_sub_${user.id}` } },
  };
}

export async function updateSubUser(id: string, body: unknown): Promise<HandlerResult> {
  const { name, status, add_balance_cents } = body as {
    name?: string;
    status?: "active" | "suspended";
    add_balance_cents?: number;
  };

  const user = await db.subUser.findUnique({ where: { id } });
  if (!user) {
    return {
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "Sub-user not found" } },
    };
  }

  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (status) updates.status = status;
  if (add_balance_cents && add_balance_cents > 0) {
    const balance = await db.balance.findFirst();
    if (!balance || balance.balanceCents < add_balance_cents) {
      return {
        status: 402,
        body: {
          success: false,
          error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient balance" },
        },
      };
    }
    await db.balance.update({
      where: { id: balance.id },
      data: { balanceCents: { decrement: add_balance_cents } },
    });
    updates.balanceCents = { increment: add_balance_cents };
  }

  const updated = await db.subUser.update({ where: { id }, data: updates });
  return { status: 200, body: { success: true, data: toApi(updated) } };
}

export async function getSubUser(id: string): Promise<HandlerResult> {
  const user = await db.subUser.findUnique({ where: { id } });
  if (!user) {
    return {
      status: 404,
      body: { success: false, error: { code: "NOT_FOUND", message: "Sub-user not found" } },
    };
  }
  return { status: 200, body: { success: true, data: toApi(user) } };
}
