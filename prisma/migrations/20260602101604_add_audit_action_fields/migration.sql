-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN "method" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "path" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "statusCode" INTEGER;
