/*
  Warnings:

  - A unique constraint covering the columns `[key]` on the table `rate_limits` will be added. If there are existing duplicate values, this will fail.
  - Made the column `key` on table `rate_limits` required. This step will fail if there are existing NULL values in that column.
  - Made the column `count` on table `rate_limits` required. This step will fail if there are existing NULL values in that column.
  - Made the column `last_request` on table `rate_limits` required. This step will fail if there are existing NULL values in that column.

*/
-- Rate-limit counters are ephemeral, so clear legacy nullable or duplicate rows before enforcing Better Auth's atomic-consume invariants.
TRUNCATE TABLE "rate_limits";

-- DropIndex
DROP INDEX "rate_limits_key_idx";

-- AlterTable
ALTER TABLE "rate_limits" ALTER COLUMN "key" SET NOT NULL,
ALTER COLUMN "count" SET NOT NULL,
ALTER COLUMN "last_request" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits"("key");
