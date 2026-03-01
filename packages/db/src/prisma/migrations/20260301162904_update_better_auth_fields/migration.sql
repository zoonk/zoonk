-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "billing_interval" TEXT,
ADD COLUMN     "stripe_schedule_id" TEXT;
