import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { z } from "zod";
import { bankQuestionSchema } from "./learner";

const countSchema = z.int().min(0);

export const focusTestResponseSchema = z
  .object({
    areas: z
      .array(z.string())
      .meta({
        description:
          "The plan's areas it asks about, in the plan's order: the ones worth most (at most ten), never a written test's or the plan's own extras. Names as plan changes (`focusAreas`) take them",
      }),
    needsItems: z
      .array(z.uuid())
      .meta({
        description:
          "Skills without a question for their place yet: POST .../focus-test/generations writes them when the learner starts the test, while `questions` are asked",
      }),
    questions: z
      .array(
        z.intersection(
          bankQuestionSchema,
          z.object({
            area: z.string().meta({ description: "The area it asks about, as learners call it" }),
          }),
        ),
      )
      .meta({
        description:
          "The questions that exist, area by area, `questionsPerArea` on each when every place has one, spread over the area's skills, in the exam's quick format and never one the learner already answered. While `needsItems` lists any, ask these first, then GET again once the run writing the others is ready and add the questions not asked yet: a question written later fills a place that had none, never one already asked",
      }),
    questionsPerArea: countSchema.meta({
      description: "Four when it asks about up to six areas, three when more",
    }),
    trueFalseLabels: trueFalseLabelsSchema,
  })
  .meta({ id: "FocusTest" });

export const focusTestGenerationSchema = z
  .object({
    generationId: z
      .string()
      .nullable()
      .meta({
        description: "The run writing the questions: stream GET /generations/{generationId}/events",
      }),
    status: z
      .enum(["ready", "generating"])
      .meta({
        description:
          "`ready`: GET the focus test now. `generating`: ask the questions the test has while following the run's stream until `focusTestQuestionsReady`, then GET it again for the rest",
      }),
  })
  .meta({ id: "FocusTestGeneration" });

export const focusTestResultSchema = z
  .object({
    areas: z
      .array(
        z.object({
          answers: z
            .array(z.boolean())
            .meta({ description: "Each answer on the area, in the order asked: right or not" }),
          chosen: z.boolean().meta({ description: "The area now has the plan's focus" }),
          correct: countSchema,
          label: z
            .string()
            .meta({ description: "What learners call it: an exam subject's short name" }),
          name: z.string().meta({ description: "The area as plan changes name it" }),
          total: countSchema,
        }),
      )
      .meta({
        description:
          "Each area answered at least three times, in the plan's order; others aren't scored",
      }),
    changeId: z
      .uuid()
      .nullable()
      .meta({
        description:
          "The plan change that set the focus; undo it through the goal's plan changes. Null when the focus was already this or the plan isn't built yet",
      }),
    focusAreas: z
      .array(z.string())
      .meta({
        description:
          "The areas that got the focus: the weakest of the ones worth most (up to three, a third of those scored at most), or, when every area is known, the one worth most",
      }),
  })
  .meta({ id: "FocusTestResult" });
