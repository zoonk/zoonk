-- CreateEnum
CREATE TYPE "SavedMindMapKind" AS ENUM ('chapter', 'lesson');

-- CreateTable
CREATE TABLE "saved_mind_maps" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "kind" "SavedMindMapKind" NOT NULL,
    "target_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "goal_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_mind_maps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_mind_maps_user_id_kind_target_id_key" ON "saved_mind_maps"("user_id", "kind", "target_id");

-- AddForeignKey
ALTER TABLE "saved_mind_maps" ADD CONSTRAINT "saved_mind_maps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
