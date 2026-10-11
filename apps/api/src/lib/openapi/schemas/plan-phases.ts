import { z } from "zod";
import { shortPhaseSchema } from "./short-exam-plans";

const isoDateSchema = z.iso.date();

const stateSchema = z.enum(["current", "done", "upcoming"]);
export const phaseKindSchema = z
  .enum(["learn", "foundations", "gaps", "practice", "finalStretch", "afterExam"])
  .meta({
    description:
      "afterExam: an exam plan that studies everything goes on after the exam with what didn't fit before it",
  });

/** A plan phase with its size and dates, its chapters and the checkpoint that closes it. */
export const planPhaseSchema = z
  .object({
    chapterCount: z.int().min(0),
    chapters: z
      .array(
        z.object({
          chapterId: z.uuid().nullable(),
          deeper: z
            .boolean()
            .meta({
              description:
                "Its lessons go deeper into topics of an earlier phase: a plan short on time studies every phase's core first and the rest after it, in a later phase's time, so the chapter shows again there. Say so, so it never reads as listed twice",
            }),
          far: z
            .boolean()
            .meta({
              description:
                "A `writing` row starting after the two weeks the plan writes ahead: say the lessons the plan teaches it (`plannedLessons`, about that many) and when it starts (`nextDate`), not that they're on the way. False for every other row",
            }),
          lessonsDone: z.int().min(0),
          lessonsTotal: z.int().min(0),
          nextDate: isoDateSchema
            .nullable()
            .meta({ description: "The first day the plan studies it; null once it's done" }),
          plannedLessons: z
            .int()
            .min(1)
            .nullable()
            .meta({
              description:
                "A `writing` row's lessons the plan teaches, after its cuts and base choices. Null for every other row, and for one of a plan saved before it stored them (until its next change): say no count then",
            }),
          skillId: z
            .uuid()
            .nullable()
            .meta({
              description:
                "A `far` row's first topic no chapter teaches yet: its lesson plan is `GET /goals/{goalId}/skills/{skillId}/outline`, and POST `.../outline/generations` writes it now. Null for every other row, including one whose lessons are on the way and one whose topics chapters already teach (the plan writes their next chapter as the learner gets close)",
            }),
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
                "Skills whose lessons aren't written yet (the plan writes them two weeks ahead), grouped under their course's title (empty for the goal's own course: say \"More lessons\"). A `far` row starts after those weeks; any other's lessons are on the way",
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
    lessonsDone: z.int().min(0).meta({ description: "Its lessons the learner studied" }),
    lessonsTotal: z
      .int()
      .min(0)
      .meta({
        description:
          "Its lessons in the plan: every one but those tested out, which are off the plan",
      }),
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
    state: z
      .enum(["current", "done", "unfinished", "upcoming"])
      .meta({
        description:
          "`current` is the earliest phase with work left. One before it is `done` once the learner finished its work, and `unfinished` while some of it was set aside (missed days the plan couldn't fit back): never mark it done; say the lessons studied of its total (`lessonsDone`, `lessonsTotal`)",
      }),
  })
  .meta({ id: "PlanPhase" });
