-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "cancel_at" TIMESTAMP(3),
ADD COLUMN     "canceled_at" TIMESTAMP(3),
ADD COLUMN     "ended_at" TIMESTAMP(3);
