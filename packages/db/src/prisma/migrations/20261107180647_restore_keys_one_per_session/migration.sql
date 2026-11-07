/*
  Warnings:

  - A unique constraint covering the columns `[session_id]` on the table `restore_keys` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "restore_keys_session_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "restore_keys_session_id_key" ON "restore_keys"("session_id");
