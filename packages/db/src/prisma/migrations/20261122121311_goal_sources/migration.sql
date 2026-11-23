-- DropForeignKey
ALTER TABLE "learner_sources" DROP CONSTRAINT "learner_sources_goal_id_fkey";

-- DropIndex
DROP INDEX "learner_sources_goal_id_idx";

-- CreateTable
CREATE TABLE "goal_sources" (
    "goal_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "origin" "LearnerSourceOrigin" NOT NULL,
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_sources_pkey" PRIMARY KEY ("goal_id","source_id")
);

-- CreateTable
CREATE TABLE "source_redirects" (
    "from_id" UUID NOT NULL,
    "to_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_redirects_pkey" PRIMARY KEY ("from_id")
);

-- CreateIndex
CREATE INDEX "goal_sources_source_id_idx" ON "goal_sources"("source_id");

-- CreateIndex
CREATE INDEX "source_redirects_to_id_idx" ON "source_redirects"("to_id");

-- CreateIndex
CREATE INDEX "source_redirects_user_id_idx" ON "source_redirects"("user_id");

-- AddForeignKey
ALTER TABLE "goal_sources" ADD CONSTRAINT "goal_sources_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_sources" ADD CONSTRAINT "goal_sources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_redirects" ADD CONSTRAINT "source_redirects_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_redirects" ADD CONSTRAINT "source_redirects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The release still running writes a goal's material to learner_sources.goal_id and answered_at.
-- This copies those writes to goal_sources until the release that drops both columns drops it.
CREATE FUNCTION copy_learner_source_goal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- That release merges an upload into its shared copy by moving the learner's link before
  -- deleting the upload, which would take the upload's goal_sources rows with it.
  IF TG_OP = 'UPDATE' AND NEW.source_id IS DISTINCT FROM OLD.source_id THEN
    INSERT INTO goal_sources (goal_id, source_id, origin, answered_at, created_at)
    SELECT moved.goal_id, NEW.source_id, moved.origin, moved.answered_at, moved.created_at
    FROM goal_sources AS moved
    JOIN goals ON goals.id = moved.goal_id
    WHERE moved.source_id = OLD.source_id AND goals.user_id = NEW.user_id
    ON CONFLICT DO NOTHING;
  END IF;

  -- Fills in only: a row already there keeps its origin and its answer.
  IF NEW.goal_id IS NOT NULL THEN
    INSERT INTO goal_sources (goal_id, source_id, origin, answered_at)
    SELECT goals.id, NEW.source_id, NEW.origin, NEW.answered_at
    FROM goals
    WHERE goals.id = NEW.goal_id AND goals.user_id = NEW.user_id
    ON CONFLICT (goal_id, source_id) DO UPDATE
    SET answered_at = EXCLUDED.answered_at
    WHERE goal_sources.answered_at IS NULL AND EXCLUDED.answered_at IS NOT NULL;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER learner_source_goal_to_goal_sources
AFTER INSERT OR UPDATE OF goal_id, answered_at, source_id ON learner_sources
FOR EACH ROW EXECUTE FUNCTION copy_learner_source_goal();

INSERT INTO goal_sources (goal_id, source_id, origin, answered_at, created_at)
SELECT learner_sources.goal_id, learner_sources.source_id, learner_sources.origin,
  learner_sources.answered_at, learner_sources.created_at
FROM learner_sources
JOIN goals ON goals.id = learner_sources.goal_id AND goals.user_id = learner_sources.user_id
ON CONFLICT DO NOTHING;
