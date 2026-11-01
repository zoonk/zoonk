/*
  Warnings:

  - A unique constraint covering the columns `[replaces_goal_id]` on the table `goals` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "replaces_goal_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "goals_replaces_goal_id_key" ON "goals"("replaces_goal_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_replaces_goal_id_fkey" FOREIGN KEY ("replaces_goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
