import { type ResearchUploadReason } from "@zoonk/db";
import { z } from "zod";

/**
 * Why research asks instead of guessing: nothing official turned up, what it found didn't pass
 * the citation check, or the exam is a teacher's test only the class's material describes.
 */
const RESEARCH_UPLOAD_REASONS = [
  "noOfficialSource",
  "unverified",
  "classMaterial",
] as const satisfies readonly ResearchUploadReason[];

/**
 * What a research run ends with. `needsUpload` never guesses: the learner is
 * asked for the notice or the list of contents (Plan and Today show the ask),
 * and research runs again with their upload.
 */
export const researchResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("missing") }),
  z.object({ status: z.literal("notNeeded") }),
  z.object({ reason: z.enum(RESEARCH_UPLOAD_REASONS), status: z.literal("needsUpload") }),
  z.object({
    examBlueprintId: z.string().nullable(),
    sourceIds: z.array(z.string()),
    status: z.literal("ready"),
  }),
]);

export type ResearchResult = z.infer<typeof researchResultSchema>;
