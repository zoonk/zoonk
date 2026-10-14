-- CreateEnum
CREATE TYPE "LiveCallLimitPeriod" AS ENUM ('day', 'month');

-- AlterTable
ALTER TABLE "live_call_connections" ADD COLUMN     "shortened_by" "LiveCallLimitPeriod";
