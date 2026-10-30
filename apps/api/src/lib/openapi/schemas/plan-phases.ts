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

export const planPhaseSchema = z
  .object({
    challengeLeftOut: z
      .boolean()
      .meta({
        description:
          "The phase keeps lessons but its challenge has no room before the plan's date, so it's off the calendar and the phase isn't done without it: say there's no time for its challenge before the date, whatever the phase's state. Another study day before the date, or a later date, brings it back; more minutes on the days the plan already has may not. A phase with nothing to study (placement found it known, or the plan holds none of its lessons) has no challenge and is never marked",
      }),
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
                "A `far` row's topic to open: its first topic no chapter teaches yet, else its first taught one. Its lesson plan is `GET /goals/{goalId}/skills/{skillId}/outline`: `ready` lists the chapters that teach it, and POST `.../outline/generations` writes an untaught one now. Null for every other row, including one whose lessons are on the way",
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
          "Every phase's chapters in plan order. At most one chapter in the plan is `current`: the one holding the next lesson, which can be in a later phase than the current one",
      }),
    checkpoint: z
      .object({
        date: isoDateSchema.nullable(),
        locked: z
          .boolean()
          .meta({
            description:
              "The challenge remains visible in the plan, but starting it requires Plus; its intro reports `locked` and `status` `plusRequired`",
          }),
        planItemId: z
          .uuid()
          .nullable()
          .meta({
            description:
              "Its intro is GET /challenges/{planItemId}; null for an unsaved selection, shown without an action link until Open persists it",
          }),
        state: z.enum(["done", "upcoming"]),
        when: z
          .enum(["date", "nextSession", "queued"])
          .meta({
            description:
              "When it comes, as sessions offer challenges and its intro says: `date`, on its `date`; `nextSession`, the learner's next session has it (the first one reached, and any whose day came): say that instead of `date`; `queued`, its phase's lessons are done but a challenge before it comes first, one a session: say it comes after that one, not `date`. Always `date` once won, and past a free exam plan's first week (its sessions hold no challenges)",
          }),
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
      .enum(["current", "done", "leftOut", "unfinished", "upcoming"])
      .meta({
        description:
          "`current` is the earliest phase with work left. One before it is `done` once the learner finished its work, and `unfinished` while some of it was set aside (missed days the plan couldn't fit back): never mark it done; say the lessons studied of its total (`lessonsDone`, `lessonsTotal`). `leftOut`: the plan holds none of its work (a date too near for its topics): say it's not in the plan, and leave it out of the phases counted done",
      }),
  })
  .meta({ id: "PlanPhase" });
