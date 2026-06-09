-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Balance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "balanceCents" INTEGER NOT NULL DEFAULT 100000,
    "totalSpentCents" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "billingType" TEXT NOT NULL,
    "proxyUsername" TEXT NOT NULL,
    "proxyPassword" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "portHttp" INTEGER NOT NULL,
    "portSocks" INTEGER,
    "connectionFormat" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "bytesUsed" BIGINT NOT NULL DEFAULT 0,
    "maxGb" REAL,
    "maxBytes" BIGINT,
    "maxMbps" INTEGER,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "purchasePriceCents" INTEGER,
    "endUserReference" TEXT,
    "allowedIps" TEXT NOT NULL DEFAULT '[]',
    "pool" TEXT,
    "quantity" INTEGER,
    "proxyList" TEXT,
    "location" TEXT
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "planId" TEXT,
    "balanceAfterCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SubUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "plansCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Investigation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investigationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "complaint" TEXT NOT NULL,
    "elapsedSeconds" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "costCents" INTEGER NOT NULL DEFAULT 50,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "severity" TEXT,
    "headline" TEXT,
    "diagnosis" TEXT,
    "errorMessage" TEXT
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Plan_planId_key" ON "Plan"("planId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "SubUser_email_key" ON "SubUser"("email");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Investigation_investigationId_key" ON "Investigation"("investigationId");

-- Recreate AuditEvent: replace apiKeyHash (NOT NULL) with userId (nullable)
CREATE TABLE "AuditEvent_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "ip" TEXT,
    "method" TEXT,
    "path" TEXT,
    "statusCode" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "AuditEvent_new" ("id", "action", "ip", "method", "path", "statusCode", "createdAt")
SELECT "id", "action", "ip", "method", "path", "statusCode", "createdAt"
FROM "AuditEvent";

DROP TABLE "AuditEvent";

ALTER TABLE "AuditEvent_new" RENAME TO "AuditEvent";

-- DropIndex (old apiKeyHash index was removed with the table)
-- CreateIndex
CREATE INDEX "AuditEvent_userId_idx" ON "AuditEvent"("userId");

-- CreateIndex (recreate — dropped with the old table)
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
