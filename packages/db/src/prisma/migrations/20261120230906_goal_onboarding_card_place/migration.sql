-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "onboarding_draft_id" UUID,
ADD COLUMN     "onboarding_place" SMALLINT;

-- CreateIndex
CREATE INDEX "goals_onboarding_draft_id_onboarding_place_idx" ON "goals"("onboarding_draft_id", "onboarding_place");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_onboarding_draft_id_fkey" FOREIGN KEY ("onboarding_draft_id") REFERENCES "onboarding_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
