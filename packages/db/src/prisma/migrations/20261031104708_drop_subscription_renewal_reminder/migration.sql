/*
  Warnings:

  - You are about to drop the column `renewal_reminder_sent_for` on the `subscriptions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "renewal_reminder_sent_for";
