/*
  Warnings:

  - Made the column `missions` on table `study_sessions` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "study_sessions" ALTER COLUMN "missions" SET NOT NULL;
