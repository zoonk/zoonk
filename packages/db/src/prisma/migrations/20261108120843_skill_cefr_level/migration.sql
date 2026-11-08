-- CreateEnum
CREATE TYPE "CefrLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- AlterTable
ALTER TABLE "skills" ADD COLUMN     "cefr_level" "CefrLevel";

-- Language levels the skill estimator awarded; the new rule never writes `skillLevels`.
DELETE FROM "certificates" WHERE "kind" = 'language_level' AND "details" ? 'skillLevels';

-- A level or plan certificate needs at least half of its lessons studied on Zoonk.
DELETE FROM "certificates"
WHERE "kind" = 'course'
  AND ("details"->>'lessonsStudied')::int * 2
    < ("details"->>'lessonsStudied')::int + ("details"->>'lessonsTestedOut')::int;
