import { z } from "zod";
import { pointsMinimumSchema } from "../../library/exams/blueprint-contract";

const itemMarkingSchema = z.object({
  part: z.string().nullable(),
  points: z.number().positive(),
  wrongPenalty: z.number().min(0).max(1),
});

export type ItemMarking = z.infer<typeof itemMarkingSchema>;

/** The blueprint's points at the start, so a later reading can't change a sitting's score. */
export const mockMarkingSchema = z.object({
  items: z.record(z.string(), itemMarkingSchema),
  maxPoints: z.number().positive().nullable(),
  parts: z.array(
    z.object({
      maxPoints: z.number().positive().nullable(),
      minimum: pointsMinimumSchema.nullable(),
      name: z.string(),
      objective: z.boolean(),
      qualifying: z.boolean(),
    }),
  ),
  totalMinimum: pointsMinimumSchema.nullable(),
});

export type MockMarking = z.infer<typeof mockMarkingSchema>;

const resultMinimumSchema = z
  .object({
    unit: pointsMinimumSchema.shape.unit.meta({
      description: "`points`, or `percent` of the test's points",
    }),
    value: z.number().meta({ description: "The least points, or percent, to reach" }),
  })
  .meta({ id: "PointsMinimum" });

const pointsTallyShape = {
  asked: z.number().meta({ description: "What this mock's questions of it were worth, in points" }),
  earned: z
    .number()
    .meta({
      description:
        "Points earned: a right answer earns its points (a partly right one its share of them), a wrong one loses its penalty and a blank earns 0, so it can be negative",
    }),
  max: z
    .number()
    .nullable()
    .meta({
      description: "The most points the whole test gives; null when the notice doesn't say",
    }),
  met: z
    .boolean()
    .nullable()
    .meta({
      description:
        "Whether `earned` reached `minimum`: judged only in a full mock that asked the whole test, null otherwise",
    }),
  minimum: resultMinimumSchema
    .nullable()
    .meta({
      description:
        "The least every candidate must reach, in points or in percent of the test's points, when this mock checks it (`met`) or projects it (`projected`); null otherwise",
    }),
  projected: z
    .number()
    .nullable()
    .meta({
      description:
        "For a mock that asked part of the test: `earned` ÷ `asked` × `max`, an estimate for the whole test that never decides `met`; null when it asked the whole test or `max` is unknown",
    }),
  short: z
    .number()
    .nullable()
    .meta({
      description: "How far below `minimum` it ended, in the minimum's unit, when `met` is false",
    }),
};

export const mockPointsSchema = z
  .object({
    ...pointsTallyShape,
    parts: z
      .array(
        z.object({
          ...pointsTallyShape,
          name: z.string().meta({ description: "The test or block, as the notice names it" }),
          qualifying: z
            .boolean()
            .meta({
              description:
                "It only has to reach its minimum and doesn't count toward the total, such as a qualifying paper",
            }),
        }),
      )
      .meta({ description: "Each test this mock asked, in the notice's order" }),
    unjudged: z
      .array(
        z.object({
          minimum: resultMinimumSchema,
          name: z
            .string()
            .nullable()
            .meta({ description: "The test, or null for the tests that count, together" }),
        }),
      )
      .meta({
        description:
          "Minimums this mock couldn't check, to list as still ahead: a written test, a test on another exam day, a test none of its questions belong to, or the tests together when it didn't ask them all",
      }),
  })
  .meta({
    description:
      "For an exam the notice scores in points: the points of the tests that count toward the result, added together, with their minimums, then each test's",
    id: "MockPoints",
  });

export type MockPoints = z.infer<typeof mockPointsSchema>;
