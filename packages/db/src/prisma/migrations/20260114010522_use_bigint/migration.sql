/*
  Warnings:

  - The primary key for the `activities` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `activity_progress` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `daily_progress` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `step_attempts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `steps` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "activity_progress" DROP CONSTRAINT "activity_progress_activity_id_fkey";

-- DropForeignKey
ALTER TABLE "step_attempts" DROP CONSTRAINT "step_attempts_step_id_fkey";

-- DropForeignKey
ALTER TABLE "steps" DROP CONSTRAINT "steps_activity_id_fkey";

-- AlterTable
ALTER TABLE "activities" DROP CONSTRAINT "activities_pkey",
ALTER COLUMN "id" SET DATA TYPE BIGINT,
ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "activity_progress" DROP CONSTRAINT "activity_progress_pkey",
ALTER COLUMN "id" SET DATA TYPE BIGINT,
ALTER COLUMN "activity_id" SET DATA TYPE BIGINT,
ADD CONSTRAINT "activity_progress_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "daily_progress" DROP CONSTRAINT "daily_progress_pkey",
ALTER COLUMN "id" SET DATA TYPE BIGINT,
ADD CONSTRAINT "daily_progress_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "step_attempts" DROP CONSTRAINT "step_attempts_pkey",
ALTER COLUMN "id" SET DATA TYPE BIGINT,
ALTER COLUMN "step_id" SET DATA TYPE BIGINT,
ADD CONSTRAINT "step_attempts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "steps" DROP CONSTRAINT "steps_pkey",
ALTER COLUMN "id" SET DATA TYPE BIGINT,
ALTER COLUMN "activity_id" SET DATA TYPE BIGINT,
ADD CONSTRAINT "steps_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "activity_progress" ADD CONSTRAINT "activity_progress_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_attempts" ADD CONSTRAINT "step_attempts_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterSequence - Change sequences to BIGINT to support larger max values
ALTER SEQUENCE activities_id_seq AS BIGINT;
ALTER SEQUENCE activity_progress_id_seq AS BIGINT;
ALTER SEQUENCE daily_progress_id_seq AS BIGINT;
ALTER SEQUENCE step_attempts_id_seq AS BIGINT;
ALTER SEQUENCE steps_id_seq AS BIGINT;
