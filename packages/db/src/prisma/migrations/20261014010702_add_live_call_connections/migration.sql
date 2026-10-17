-- CreateEnum
CREATE TYPE "LiveCallAdmission" AS ENUM ('off', 'staff', 'all');

-- CreateEnum
CREATE TYPE "LiveCallState" AS ENUM ('pending', 'creating', 'active', 'closing', 'closed');

-- CreateEnum
CREATE TYPE "LiveCallCostConfidence" AS ENUM ('reserved', 'unconfirmed', 'confirmed', 'estimated');

-- CreateEnum
CREATE TYPE "LiveCallEndReason" AS ENUM ('deadline', 'completion', 'reconnect', 'takeover', 'admin', 'expired', 'timer_failed');

-- CreateTable
CREATE TABLE "live_call_settings" (
    "id" TEXT NOT NULL,
    "admission" "LiveCallAdmission" NOT NULL DEFAULT 'off',
    "free_daily_budget_micros" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_call_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "free_call_spend_days" (
    "day" DATE NOT NULL,
    "spent_micros" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "free_call_spend_days_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "live_call_connections" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "request_id" UUID NOT NULL,
    "state" "LiveCallState" NOT NULL DEFAULT 'pending',
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "workflow_run_id" TEXT,
    "provider_session_id" TEXT,
    "attempt_number" INTEGER NOT NULL,
    "held_seconds" INTEGER NOT NULL,
    "prior_usage_seconds" INTEGER NOT NULL DEFAULT 0,
    "reserved_micros" INTEGER NOT NULL,
    "settled_micros" INTEGER NOT NULL DEFAULT 0,
    "liability_micros" INTEGER NOT NULL,
    "cost_confidence" "LiveCallCostConfidence" NOT NULL DEFAULT 'reserved',
    "free_spend_day" DATE,
    "usage_record_id" UUID NOT NULL,
    "end_reason" "LiveCallEndReason",
    "close_attempts" INTEGER NOT NULL DEFAULT 0,
    "provider_started_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "last_close_at" TIMESTAMP(3),
    "recovery_unconfirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_call_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_call_slots" (
    "user_id" UUID NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "connection_id" UUID,

    CONSTRAINT "live_call_slots_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_call_connections_provider_session_id_key" ON "live_call_connections"("provider_session_id");

-- CreateIndex
CREATE INDEX "live_call_connections_user_id_created_at_idx" ON "live_call_connections"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "live_call_connections_conversation_id_created_at_idx" ON "live_call_connections"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "live_call_connections_state_deadline_at_idx" ON "live_call_connections"("state", "deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "live_call_connections_user_id_request_id_key" ON "live_call_connections"("user_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "live_call_slots_connection_id_key" ON "live_call_slots"("connection_id");

-- AddForeignKey
ALTER TABLE "live_call_slots" ADD CONSTRAINT "live_call_slots_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "live_call_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
