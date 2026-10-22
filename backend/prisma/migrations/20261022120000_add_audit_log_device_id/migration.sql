-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "deviceId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_deviceId_idx" ON "AuditLog"("deviceId");
