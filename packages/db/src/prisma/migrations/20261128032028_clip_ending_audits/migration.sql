-- CreateEnum
CREATE TYPE "ClipEndingAddition" AS ENUM ('none', 'speech', 'sound');

-- CreateTable
CREATE TABLE "clip_ending_audits" (
    "unit" "ContentFixUnit" NOT NULL,
    "clip_id" UUID NOT NULL,
    "audio_url" TEXT NOT NULL,
    "claim_expires_at" TIMESTAMP(3) NOT NULL,
    "added" "ClipEndingAddition",
    "heard" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "clip_ending_audits_pkey" PRIMARY KEY ("unit","clip_id","audio_url")
);
