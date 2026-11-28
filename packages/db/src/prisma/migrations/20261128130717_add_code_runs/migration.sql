-- CreateEnum
CREATE TYPE "CodeRunStop" AS ENUM ('done', 'error', 'timeout', 'too_much_output', 'unavailable');

-- AlterEnum
ALTER TYPE "UsageKind" ADD VALUE 'code_run';

-- CreateTable
CREATE TABLE "code_runs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "sandbox_name" TEXT NOT NULL,
    "stop" "CodeRunStop",
    "output" TEXT,
    "error_output" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "code_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "code_runs_user_id_finished_at_idx" ON "code_runs"("user_id", "finished_at");

-- CreateIndex
CREATE UNIQUE INDEX "code_runs_user_id_request_id_key" ON "code_runs"("user_id", "request_id");

-- AddForeignKey
ALTER TABLE "code_runs" ADD CONSTRAINT "code_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
