/*
  Warnings:

  - Changed the type of `kind` on the `steps` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "StepKind" AS ENUM ('static', 'fill_blank', 'match_columns', 'multiple_choice', 'select_image', 'sort_order', 'arrange_words');

-- AlterTable
ALTER TABLE "steps" DROP COLUMN "kind",
ADD COLUMN     "kind" "StepKind" NOT NULL;
