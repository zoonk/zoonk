-- CreateEnum
CREATE TYPE "SourceReadState" AS ENUM ('owed', 'read', 'failed');

-- AlterTable
ALTER TABLE "sources" ADD COLUMN     "read_state" "SourceReadState";
