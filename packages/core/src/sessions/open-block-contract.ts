import { z } from "zod";
import { answerTimeZoneSchema } from "../learner/contract";

const studyBlockOpeningTargetSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        expectedBlockId: z
          .uuid()
          .optional()
          .meta({
            description:
              "The step the learner saw as next. When the session's next step changed to or from a mock, nothing opens (`changed`), so Continue never begins a mock the learner didn't see",
          }),
        kind: z.literal("next"),
        sessionId: z.uuid(),
      })
      .strict()
      .meta({ description: "Continue: the session's next step", id: "StudyBlockOpeningNext" }),
    z
      .object({ blockId: z.uuid(), kind: z.literal("block") })
      .strict()
      .meta({
        description:
          "A tap on a block of a saved session, a block just added (extra time, practice), or a lesson whose writing just ended",
        id: "StudyBlockOpeningBlock",
      }),
    z
      .object({ blockId: z.uuid(), kind: z.literal("mission") })
      .strict()
      .meta({
        description:
          "A mission card's block. It opens only while the block is still free to start; otherwise nothing opens (`changed`)",
        id: "StudyBlockOpeningMission",
      }),
  ])
  .meta({ id: "StudyBlockOpeningTarget" });

export const openStudyBlockInputSchema = z
  .object({ target: studyBlockOpeningTargetSchema, timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "StudyBlockOpeningInput" });

export type OpenStudyBlockInput = z.infer<typeof openStudyBlockInputSchema>;

const sessionIdSchema = z.uuid().meta({ description: "The study session the block belongs to" });

export const studyBlockOpeningSchema = z
  .discriminatedUnion("kind", [
    z
      .object({ kind: z.literal("lesson"), lessonId: z.uuid(), sessionId: sessionIdSchema })
      .strict()
      .meta({
        description: "The block started: open the lesson player",
        id: "StudyBlockOpeningLesson",
      }),
    z
      .object({
        blockId: z.uuid(),
        kind: z.literal("unwrittenLesson"),
        lessonId: z.uuid(),
        sessionId: sessionIdSchema,
      })
      .strict()
      .meta({
        description:
          "The lesson isn't written and the block isn't started, so nothing competes with the learner's request: ask for the lesson (`POST /v1/library/lessons/{lessonId}/generations`), follow its run, then open the block again (`target.kind` `block`)",
        id: "StudyBlockOpeningUnwrittenLesson",
      }),
    z
      .object({ blockId: z.uuid(), kind: z.literal("preparingLesson") })
      .strict()
      .meta({
        description:
          "The plan hasn't picked this step's lesson yet. The server is preparing it: show the session waiting on the block and read it again",
        id: "StudyBlockOpeningPreparingLesson",
      }),
    z
      .object({ blockId: z.uuid(), kind: z.literal("essay") })
      .strict()
      .meta({ description: "The block started: open the essay", id: "StudyBlockOpeningEssay" }),
    z
      .object({ blockId: z.uuid(), kind: z.literal("checkpoint"), sessionId: sessionIdSchema })
      .strict()
      .meta({
        description:
          "Open the challenge's screen (a language goal's call opens on its intro), which starts it",
        id: "StudyBlockOpeningCheckpoint",
      }),
    z
      .object({ blockId: z.uuid(), kind: z.literal("mock"), sessionId: sessionIdSchema })
      .strict()
      .meta({
        description: "Open the mock's screen, which starts it",
        id: "StudyBlockOpeningMock",
      }),
    z
      .object({ kind: z.literal("challenge"), planItemId: z.uuid(), sessionId: sessionIdSchema })
      .strict()
      .meta({
        description:
          "Open the challenge's intro by its plan item (`GET /v1/challenges/{planItemId}`): it isn't a language call, or it needs Plus",
        id: "StudyBlockOpeningChallenge",
      }),
    z
      .object({
        blockId: z
          .uuid()
          .nullable()
          .meta({
            description:
              "The review or practice block that started here; null when the step is already finished or the session has no next step",
          }),
        kind: z.literal("session"),
      })
      .strict()
      .meta({ description: "Open the session screen", id: "StudyBlockOpeningSession" }),
    z
      .object({ kind: z.literal("today") })
      .strict()
      .meta({
        description:
          "Back to Today: the day is over, today's time limit is reached, or earlier work comes first",
        id: "StudyBlockOpeningToday",
      }),
    z
      .object({ kind: z.literal("changed") })
      .strict()
      .meta({
        description:
          "Nothing opened: what the learner saw changed (a mock they didn't see, a mission no longer free to start). Read the screen again so they see the change first",
        id: "StudyBlockOpeningChanged",
      }),
  ])
  .meta({ id: "StudyBlockOpening" });

export type StudyBlockOpening = z.infer<typeof studyBlockOpeningSchema>;

export type OpenStudyBlockResult =
  | { opening: StudyBlockOpening; status: "ready" }
  | { status: "goalNotActive" | "notFound" | "retryable" | "unauthorized" };
