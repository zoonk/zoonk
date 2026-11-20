-- CreateTable
CREATE TABLE "skill_outline_asks" (
    "goal_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "asked_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_outline_asks_pkey" PRIMARY KEY ("goal_id","skill_id")
);

-- AddForeignKey
ALTER TABLE "skill_outline_asks" ADD CONSTRAINT "skill_outline_asks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
