import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const LESSON_RICH_TEXT = "Rich text: the lesson Markdown subset and `$…$` math";

export const firstQuestionSchema = z
  .object({
    context: z
      .string()
      .nullable()
      .meta({
        description: `What the question follows; null when it stands alone. ${LESSON_RICH_TEXT}`,
      }),
    guess: z
      .boolean()
      .meta({
        description:
          "A guess before the lesson teaches it, which doesn't count; otherwise a question the lesson checks",
      }),
    kind: z.literal("choice"),
    options: z
      .array(z.object({ id: z.string(), text: z.string().meta({ description: LESSON_RICH_TEXT }) }))
      .meta({
        description:
          "Without which is right: the lesson checks the answer the learner opens it with",
      }),
    question: z.string().meta({ description: LESSON_RICH_TEXT }),
  })
  .meta({ id: "CatalogFirstQuestion" });

export const catalogTryLessonSchema = z
  .object({
    chapterTitle: z.string(),
    lessonId: uuidSchema(),
    minutes: z.int().nonnegative(),
    number: z.int().min(1).meta({ description: "The lesson's number in its chapter" }),
    screen: firstQuestionSchema,
  })
  .meta({
    description:
      "A lesson to try from the page: among the first lessons, one that opens with a guess, else with a question. Opening it with an option answers its first screen.",
    id: "CatalogTryLesson",
  });
