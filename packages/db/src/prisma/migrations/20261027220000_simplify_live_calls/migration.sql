-- Development databases may hold connections from the previous lifecycle, whose states and costs
-- have no equivalent here; production has none, since live calls are new in learning v2.
DELETE FROM "live_call_connections";

-- AlterEnum
BEGIN;
CREATE TYPE "LiveCallEndReason_new" AS ENUM ('learner', 'deadline', 'reconnect', 'takeover', 'completion', 'refused', 'failed');
ALTER TABLE "live_call_connections" ALTER COLUMN "end_reason" TYPE "LiveCallEndReason_new" USING ("end_reason"::text::"LiveCallEndReason_new");
ALTER TYPE "LiveCallEndReason" RENAME TO "LiveCallEndReason_old";
ALTER TYPE "LiveCallEndReason_new" RENAME TO "LiveCallEndReason";
DROP TYPE "public"."LiveCallEndReason_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "LiveCallState_new" AS ENUM ('reserved', 'starting', 'live', 'ended');
ALTER TABLE "public"."live_call_connections" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "live_call_connections" ALTER COLUMN "state" TYPE "LiveCallState_new" USING ("state"::text::"LiveCallState_new");
ALTER TYPE "LiveCallState" RENAME TO "LiveCallState_old";
ALTER TYPE "LiveCallState_new" RENAME TO "LiveCallState";
DROP TYPE "public"."LiveCallState_old";
ALTER TABLE "live_call_connections" ALTER COLUMN "state" SET DEFAULT 'reserved';
COMMIT;

-- DropForeignKey
ALTER TABLE "live_call_slots" DROP CONSTRAINT "live_call_slots_connection_id_fkey";

-- DropIndex
DROP INDEX "live_call_connections_user_id_request_id_key";

-- AlterTable
ALTER TABLE "language_conversations" DROP COLUMN "completion_started_at",
ADD COLUMN     "review_run_id" TEXT;

-- AlterTable
ALTER TABLE "live_call_connections" DROP COLUMN "attempt_number",
DROP COLUMN "close_attempts",
DROP COLUMN "closed_at",
DROP COLUMN "cost_confidence",
DROP COLUMN "generation",
DROP COLUMN "last_close_at",
DROP COLUMN "liability_micros",
DROP COLUMN "prior_usage_seconds",
DROP COLUMN "provider_started_at",
DROP COLUMN "recovery_unconfirmed_at",
DROP COLUMN "request_id",
DROP COLUMN "reserved_micros",
DROP COLUMN "settled_micros",
DROP COLUMN "shortened_by",
DROP COLUMN "updated_at",
DROP COLUMN "usage_record_id",
DROP COLUMN "workflow_run_id",
ADD COLUMN     "cost_micros" INTEGER NOT NULL,
ADD COLUMN     "ended_at" TIMESTAMP(3),
ADD COLUMN     "started_at" TIMESTAMP(3),
ALTER COLUMN "state" SET DEFAULT 'reserved';

-- DropTable
DROP TABLE "live_call_slots";

-- DropEnum
DROP TYPE "LiveCallCostConfidence";

-- DropEnum
DROP TYPE "LiveCallLimitPeriod";

-- CreateIndex
CREATE INDEX "live_call_connections_user_id_state_idx" ON "live_call_connections"("user_id", "state");

-- CreateIndex
CREATE INDEX "live_call_connections_free_spend_day_state_idx" ON "live_call_connections"("free_spend_day", "state");

