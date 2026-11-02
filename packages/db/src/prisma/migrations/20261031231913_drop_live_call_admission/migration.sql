/*
  Warnings:

  - You are about to drop the column `free_spend_day` on the `live_call_connections` table. All the data in the column will be lost.
  - You are about to drop the `free_call_spend_days` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `live_call_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "live_call_connections_free_spend_day_state_idx";

-- AlterTable
ALTER TABLE "live_call_connections" DROP COLUMN "free_spend_day";

-- DropTable
DROP TABLE "free_call_spend_days";

-- DropTable
DROP TABLE "live_call_settings";

-- DropEnum
DROP TYPE "LiveCallAdmission";
