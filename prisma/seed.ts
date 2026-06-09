import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const dbUrl = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const db = new PrismaClient({ adapter });

async function main() {
  // ── Admin user ──────────────────────────────────────────────────────────────
  const email = process.env.SEED_EMAIL ?? "admin@proxydesk.local";
  const password = process.env.SEED_PASSWORD ?? "proxydesk123";
  const hash = await bcrypt.hash(password, 12);

  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash: hash },
    create: { email, passwordHash: hash, name: "Admin" },
  });
  console.log(`Admin user: ${user.email} / ${password}`);

  // ── Balance ─────────────────────────────────────────────────────────────────
  const existing = await db.balance.findFirst();
  const balance =
    existing ?? (await db.balance.create({ data: { balanceCents: 50000, totalSpentCents: 0 } }));

  // ── Sample plans ────────────────────────────────────────────────────────────
  const planCount = await db.plan.count();
  if (planCount === 0) {
    const plans = [
      {
        planId: randomUUID(),
        product: "datacenter",
        billingType: "bandwidth",
        proxyUsername: "user_dc01",
        proxyPassword: "pass_dc01",
        hostname: "dc.proxydesk.local",
        portHttp: 8080,
        portSocks: 1080,
        connectionFormat: "user_dc01:pass_dc01@dc.proxydesk.local:8080",
        status: "active",
        maxGb: 10,
        maxBytes: BigInt(10 * 1e9),
        bytesUsed: BigInt(1_200_000_000),
        purchasePriceCents: 1000,
        expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      },
      {
        planId: randomUUID(),
        product: "residential",
        billingType: "bandwidth",
        proxyUsername: "user_res01",
        proxyPassword: "pass_res01",
        hostname: "res.proxydesk.local",
        portHttp: 8080,
        portSocks: null,
        connectionFormat: "user_res01:pass_res01@res.proxydesk.local:8080",
        status: "active",
        maxGb: 5,
        maxBytes: BigInt(5 * 1e9),
        bytesUsed: BigInt(500_000_000),
        purchasePriceCents: 1500,
        expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      },
      {
        planId: randomUUID(),
        product: "shared_isp",
        billingType: "bandwidth",
        proxyUsername: "user_isp01",
        proxyPassword: "pass_isp01",
        hostname: "isp.proxydesk.local",
        portHttp: 8080,
        portSocks: 1080,
        connectionFormat: "user_isp01:pass_isp01@isp.proxydesk.local:8080",
        status: "expired",
        maxGb: 3,
        maxBytes: BigInt(3 * 1e9),
        bytesUsed: BigInt(3_000_000_000),
        purchasePriceCents: 600,
        expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    ];

    let totalSpent = 0;
    for (const p of plans) {
      await db.plan.create({ data: { ...p, allowedIps: "[]" } });
      totalSpent += p.purchasePriceCents;
      await db.transaction.create({
        data: {
          type: "purchase",
          amountCents: -p.purchasePriceCents,
          description: `${p.product} - ${p.maxGb}GB`,
          planId: p.planId,
          balanceAfterCents: balance.balanceCents - totalSpent,
        },
      });
    }

    await db.balance.update({
      where: { id: balance.id },
      data: {
        balanceCents: balance.balanceCents - totalSpent,
        totalSpentCents: totalSpent,
      },
    });

    console.log(`Created ${plans.length} sample plans`);
  } else {
    console.log(`Skipped plans (${planCount} already exist)`);
  }

  // ── Sample sub-users ────────────────────────────────────────────────────────
  const subCount = await db.subUser.count();
  if (subCount === 0) {
    await db.subUser.createMany({
      data: [
        { email: "client1@example.com", name: "Alice Johnson", balanceCents: 5000, plansCount: 2 },
        {
          email: "client2@example.com",
          name: "Bob Smith",
          balanceCents: 1000,
          plansCount: 1,
          status: "suspended",
        },
      ],
    });
    console.log("Created 2 sample sub-users");
  }

  // ── Top-up transaction ──────────────────────────────────────────────────────
  const txCount = await db.transaction.count({ where: { type: "topup" } });
  if (txCount === 0) {
    await db.transaction.create({
      data: {
        type: "topup",
        amountCents: 50000,
        description: "Initial balance top-up",
        balanceAfterCents: 50000,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
