import { type EssayView, essayGradeSchema } from "@zoonk/core/exams/essays/contract";
import { StudyBlockStatus } from "@zoonk/db";
import { z } from "zod";

/** Writing practice graded by an official rubric: an essay, a legal brief or an AP free response. */
export const essayViewResponseSchema = z
  .object({
    blockId: z.uuid(),
    context: z.string().nullable(),
    drafts: z.array(
      z.object({ grade: essayGradeSchema, submittedAt: z.iso.datetime(), text: z.string() }),
    ),
    gradesLeft: z.number().int().min(0),
    question: z.string(),
    rubric: z
      .enum(["ap", "enem", "oab", "custom"])
      .meta({
        description:
          "The official rubric: ENEM, OAB, AP scoring guidelines (rows with their own points) or the item's own criteria",
      }),
    sessionId: z.uuid(),
    status: z.enum(StudyBlockStatus),
  })
  .meta({ id: "Essay" }) satisfies z.ZodType<EssayView>;
