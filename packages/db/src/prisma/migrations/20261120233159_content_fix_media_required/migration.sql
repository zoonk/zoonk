/*
  Warnings:

  - You are about to drop the column `voice` on the `content_fixes` table. All the data in the column will be lost.
  - Made the column `media` on table `content_fixes` required. This step will fail if there are existing NULL values in that column.

*/
-- Fixes still without media get it from the trigger 20261120094942_content_fix_media added, the
-- rule that migration used: a fix's single voice clip becomes its media, and any other fix has none.
-- Media already set is never touched.
UPDATE "content_fixes" SET "voice" = "voice" WHERE "media" IS NULL;

-- The trigger copied the outgoing release's voice writes into media, and it depends on "voice".
DROP TRIGGER "content_fix_voice_to_media" ON "content_fixes";
DROP FUNCTION "copy_content_fix_voice_to_media"();

-- AlterTable
ALTER TABLE "content_fixes" DROP COLUMN "voice",
ALTER COLUMN "media" SET NOT NULL;
