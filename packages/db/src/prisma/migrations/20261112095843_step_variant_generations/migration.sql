-- CreateTable
CREATE TABLE "step_variant_generations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "step_id" UUID NOT NULL,
    "kind" "StepVariantKind" NOT NULL,
    "key" TEXT NOT NULL,
    "claimed_run_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "held_back_drafts" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "step_variant_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "step_variant_generations_step_id_kind_key_key" ON "step_variant_generations"("step_id", "kind", "key");

-- AddForeignKey
ALTER TABLE "step_variant_generations" ADD CONSTRAINT "step_variant_generations_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "library_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
