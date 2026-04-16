-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('stripe', 'google', 'apple', 'zoonk');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "provider" "SubscriptionProvider" NOT NULL DEFAULT 'stripe';
