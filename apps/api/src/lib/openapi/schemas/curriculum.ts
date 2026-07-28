import { z } from "zod";

export const generationStatusSchema = z.enum(["completed", "failed", "pending", "running"]);

export const courseFormatSchema = z.enum([
  "coding",
  "core",
  "exam",
  "instrument",
  "language",
  "personalized",
  "practical",
  "question",
]);

export const lessonKindSchema = z.enum([
  "alphabet",
  "custom",
  "explanation",
  "grammar",
  "listening",
  "practice",
  "quiz",
  "reading",
  "review",
  "translation",
  "tutorial",
  "vocabulary",
]);
