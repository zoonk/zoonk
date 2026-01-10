-- Add generation_status to courses
ALTER TABLE "courses" ADD COLUMN "generation_status" VARCHAR(20) NOT NULL DEFAULT 'completed';

-- Make description optional with default empty string
ALTER TABLE "courses" ALTER COLUMN "description" SET DEFAULT '';

