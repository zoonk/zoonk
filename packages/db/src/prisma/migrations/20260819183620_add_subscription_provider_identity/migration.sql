/*
  Warnings:

  - A unique constraint covering the columns `[provider,provider_subscription_id]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "provider_environment" TEXT,
ADD COLUMN     "provider_event_id" TEXT,
ADD COLUMN     "provider_product_id" TEXT,
ADD COLUMN     "provider_signed_at" TIMESTAMP(3),
ADD COLUMN     "provider_subscription_id" TEXT,
ADD COLUMN     "provider_transaction_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_provider_subscription_id_key" ON "subscriptions"("provider", "provider_subscription_id");
