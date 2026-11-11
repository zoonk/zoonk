/*
  Warnings:

  - You are about to drop the column `instructions` on the `user_learning_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `interests` on the `user_learning_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `preferences` on the `user_learning_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_learning_profiles" DROP COLUMN "instructions",
DROP COLUMN "interests",
DROP COLUMN "preferences";
