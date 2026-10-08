import { z } from "zod";
import { shortPhaseSchema } from "./short-exam-plans";

const isoDateSchema = z.iso.date();

const stateSchema = z.enum(["current", "done", "upcoming"]);
export const phaseKindSchema = z.enum(["learn", "foundations", "gaps", "practice", "finalStretch"]);

/** A plan phase with its size and dates, its chapters and the checkpoint that closes it. */
export const planPhaseSchema = z
  .object({
    chapterCount: z.int().min(0),
    chapters: z
      .array(
        z.object({
          chapterId: z.uuid().nullable(),
          lessonsDone: z.int().min(0),
          lessonsTotal: z.int().min(0),
          skills: z
            .array(z.string())
            .meta({
              description:
                "For a row of skills placement tested out before their lessons were written: their names in plan order, to name the row by instead of its course's title. Empty for every other row",
            }),
          state: stateSchema,
          testedOut: z
            .boolean()
            .meta({
              description:
                "Every lesson in it was tested out (placement or a test-out), so it's done without being studied; say so",
            }),
          title: z.string(),
          writing: z
            .boolean()
            .meta({
              description:
                "Skills whose lessons are still being written, grouped under their course's title; their lesson counts are stand-ins",
            }),
        }),
      )
      .meta({
        description:
          "Every phase's chapters in plan order; only the current phase has a `current` chapter",
      }),
    checkpoint: z
      .object({
        date: isoDateSchema.nullable(),
        planItemId: z.uuid().meta({ description: "Its intro is GET /challenges/{planItemId}" }),
        state: z.enum(["done", "upcoming"]),
      })
      .nullable()
      .meta({
        description: "The checkpoint that closes the phase (the Trickster); null without one",
      }),
    endDate: isoDateSchema.nullable(),
    hours: z.number().min(0),
    index: z.int().min(0),
    kind: phaseKindSchema.meta({
      description: "Exam phases have no name; clients name them by kind",
    }),
    lessonsDone: z.int().min(0),
    lessonsTotal: z.int().min(0),
    milestone: z.string().nullable(),
    mocks: z
      .object({
        count: z.int().min(0),
        nextDate: isoDateSchema
          .nullable()
          .meta({ description: "The day of the phase's next mock still to take" }),
      })
      .meta({ description: "The phase's mock exams" }),
    name: z.string(),
    short: shortPhaseSchema,
    startDate: isoDateSchema.nullable(),
    state: stateSchema,
  })
  .meta({ id: "PlanPhase" });
