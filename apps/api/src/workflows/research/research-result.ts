import { type ResearchUploadReason } from "@zoonk/db";
import { z } from "zod";

const RESEARCH_UPLOAD_REASONS = [
  "noOfficialSource",
  "unverified",
  "classMaterial",
] as const satisfies readonly ResearchUploadReason[];

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
