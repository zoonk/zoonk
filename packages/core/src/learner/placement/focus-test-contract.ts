import { z } from "zod";
import { planChangeSchema } from "../../plans/plan-change-contract";
import { answerTimeZoneSchema } from "../contract";

const countSchema = z.int().min(0);

const UNCHECKED_PARTS = ["written", "listening", "speaking", "practical"] as const;

const uncheckedPartSchema = z
  .enum(UNCHECKED_PARTS)
  .meta({ description: "The kind of exam part the test's quick questions can't check" });

export type UncheckedPart = z.infer<typeof uncheckedPartSchema>;

const subjectNameShape = {
  key: z.string().meta({ description: "Identifies the subject in lists; never shown" }),
  name: z.string().meta({ description: "The subject as the exam's notice names it" }),
  shortName: z
    .string()
    .nullable()
    .meta({ description: "What learners call it; show it when set, else `name`" }),
};

const focusTestSubjectSchema = z
  .object({
    ...subjectNameShape,
    asked: countSchema.meta({ description: "Test answers on the subject" }),
    part: uncheckedPartSchema.nullable().meta({ description: "Set only for `notChecked`" }),
    right: countSchema.meta({ description: "How many of `asked` were right" }),
    state: z
      .enum(["answered", "notAsked", "notChecked"])
      .meta({
        description:
          "`answered`: say `right` of `asked` right. `notAsked`: no test answer yet, or no question is ready for it. `notChecked`: a part this test can't ask about (`part`)",
      }),
  })
  .meta({ id: "FocusTestSubject" });

export type FocusTestSubject = z.infer<typeof focusTestSubjectSchema>;

const SITTING_KINDS = ["first", "continuation"] as const;

export const SITTING_ENDS = ["ceiling", "settled", "noQuestionsReady"] as const;

const focusTestSittingSchema = z
  .object({
    answered: countSchema,
    end: z
      .enum(SITTING_ENDS)
      .nullable()
      .meta({
        description:
          "Why this sitting asks nothing more; null while it goes on. `ceiling`: its promised count was reached. `settled`: every starting point is set. `noQuestionsReady`: no question is ready for what's left, which the next sessions ask. Finish the sitting with POST .../placement/completion",
      }),
    hint: z
      .enum(["manyUnknown"])
      .nullable()
      .meta({
        description:
          '`manyUnknown` after five "I don\'t know yet" in a row: say that stopping here and starting to learn is fine',
      }),
    kind: z.enum(SITTING_KINDS),
    left: countSchema.meta({ description: "`questions` minus `answered`" }),
    minutes: countSchema.meta({ description: "About how long `left` takes at the learner's pace" }),
    questions: countSchema.meta({
      description:
        "The most questions this sitting asks, fixed when it started; number the one asked as `answered` + 1 of it",
    }),
    subject: z
      .object(subjectNameShape)
      .nullable()
      .meta({ description: "The subject `next` asks about; null when there is no `next`" }),
  })
  .meta({ id: "FocusTestSitting" });

export type FocusTestSitting = z.infer<typeof focusTestSittingSchema>;

const sittingOfferShape = {
  minutes: countSchema.meta({
    description: "About how long `questions` take, from the same count",
  }),
  questions: countSchema.meta({ description: "The most questions the sitting would ask" }),
};

const focusTestOfferSchema = z
  .object({
    ...sittingOfferShape,
    kind: z.enum(SITTING_KINDS),
    pastCeiling: countSchema.meta({
      description:
        "Subjects the test can ask about, still without an answer, that this sitting can't reach; above 0, say some subjects may not be checked",
    }),
  })
  .meta({ id: "FocusTestOffer" });

export type FocusTestOffer = z.infer<typeof focusTestOfferSchema>;

export const FOCUS_REASONS = [
  "answers",
  "minimumScore",
  "notChecked",
  "notAsked",
  "weight",
] as const;

const focusRowSchema = z
  .object({
    areas: z
      .array(z.string())
      .meta({ description: "The plan areas a focus on it names, as `focusAreas` takes them" }),
    part: uncheckedPartSchema.nullable().meta({ description: "Set only for `notChecked`" }),
    reason: z
      .enum(FOCUS_REASONS)
      .meta({
        description:
          "`answers`: one of its answers was a miss or \"I don't know yet\". `minimumScore`: the part has a minimum score. `notChecked`: it counts heavily and this test can't check it (`part`). `notAsked`: it counts heavily and wasn't asked yet. `weight`: answered right, and still among the heaviest",
      }),
    subject: z.object(subjectNameShape),
  })
  .meta({ id: "FocusTestFocusRow" });

export type FocusRow = z.infer<typeof focusRowSchema>;

const focusTestFocusSchema = z
  .object({
    basis: z
      .enum(["answers", "importance"])
      .meta({
        description:
          "`importance`: no row comes from an answer, so say the suggestion follows mainly what the exam weighs",
      }),
    proposal: planChangeSchema
      .nullable()
      .meta({ description: "For `proposed`: the change to apply or decline, with its effect" }),
    rows: z.array(focusRowSchema).meta({ description: "Up to three, the most needed first" }),
    state: z
      .enum(["ifTimeShort", "proposed", "current", "handPicked"])
      .meta({
        description:
          "`ifTimeShort`: the plan isn't shown yet; saving a daily time that doesn't cover everything sets this focus. `proposed`: `proposal` waits for the learner's answer. `current`: the plan already focuses these. `handPicked`: the learner chose their own focus, which the test never changes",
      }),
  })
  .meta({ id: "FocusTestFocus" });

export type FocusTestFocus = z.infer<typeof focusTestFocusSchema>;

const focusTestCheckpointSchema = z
  .object({
    focus: focusTestFocusSchema
      .nullable()
      .meta({
        description:
          "Where the plan should give more time. Null without a date, with one subject, and on a shown plan whose time covers everything",
      }),
    lessonsSkipped: countSchema.meta({
      description:
        "The plan's lessons the answers so far skip; 0 when subjects start from the basics for now",
    }),
  })
  .meta({ id: "FocusTestCheckpoint" });

export type FocusTestCheckpoint = z.infer<typeof focusTestCheckpointSchema>;

export const SESSION_QUESTIONS = ["off", "on", "paused", "skippedToday"] as const;

const sessionQuestionsSchema = z
  .enum(SESSION_QUESTIONS)
  .meta({
    description:
      "Whether sessions ask up to three test questions each. `off`: the test hasn't started, or nothing is left for sessions to ask. `paused` and `skippedToday`: the learner's choice",
    id: "FocusTestSessionQuestions",
  });

export type SessionQuestions = z.infer<typeof sessionQuestionsSchema>;

export const focusTestViewSchema = z
  .object({
    checkpoint: focusTestCheckpointSchema
      .nullable()
      .meta({ description: "The result so far; null until the learner has a test answer" }),
    counts: z.object({
      asked: countSchema.meta({ description: "Subjects with at least one test answer" }),
      quick: countSchema.meta({ description: "Subjects this test can ask about" }),
      total: countSchema.meta({
        description: "Every subject, written and listening parts included",
      }),
    }),
    dated: z
      .boolean()
      .meta({ description: "The goal has a date, so the test can also suggest where to focus" }),
    offer: focusTestOfferSchema
      .nullable()
      .meta({
        description:
          "The sitting POST .../placement/sittings would open; null while one is open and when nothing is left to ask",
      }),
    sessionQuestions: sessionQuestionsSchema,
    sitting: focusTestSittingSchema.nullable().meta({ description: "The open sitting" }),
    subjects: z
      .array(focusTestSubjectSchema)
      .meta({ description: "Every subject, in the notice's order" }),
  })
  .meta({ id: "FocusTest" });

export type FocusTestView = z.infer<typeof focusTestViewSchema>;

export const focusTestSummarySchema = z
  .object({
    offer: z
      .object(sittingOfferShape)
      .nullable()
      .meta({
        description:
          "`notStarted`: the first sitting. `sitting`: what's left of the open one. `checked`: a further sitting. Null when nothing is left to ask",
      }),
    sessionQuestions: sessionQuestionsSchema,
    setsFocus: z
      .boolean()
      .meta({ description: "The plan's focus came from the test, not from the learner's pick" }),
    state: z
      .enum(["notStarted", "sitting", "checked"])
      .meta({
        description:
          "`sitting`: a sitting is open with questions left. `checked`: the learner has test answers and no sitting open",
      }),
    subjects: z
      .object({ asked: countSchema, total: countSchema })
      .nullable()
      .meta({
        description:
          "Subjects with a test answer, of all of them. Null before the first answer, and for a goal placed before the Focus test until its next test answer",
      }),
  })
  .meta({ id: "FocusTestSummary" });

export type FocusTestSummary = z.infer<typeof focusTestSummarySchema>;

export const placementSittingInputSchema = z
  .object({ timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "PlacementSittingInput" });

export type PlacementSittingInput = z.infer<typeof placementSittingInputSchema>;

export const focusTestControlsInputSchema = z
  .object({
    sessionQuestions: z
      .enum(["on", "paused", "skippedToday"])
      .optional()
      .meta({
        description:
          "`skippedToday` and `paused` take today's unanswered test questions out of the day's session, until the learner's next day or until `on`. Nothing is recorded as unknown",
      }),
    suggestion: z
      .enum(["dismissed"])
      .optional()
      .meta({ description: "Today stops suggesting the test for this goal" }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .refine((input) => input.sessionQuestions !== undefined || input.suggestion !== undefined, {
    message: "Send sessionQuestions or suggestion",
  })
  .meta({ id: "FocusTestControlsInput" });

export type FocusTestControlsInput = z.infer<typeof focusTestControlsInputSchema>;

export const todayFocusTestSchema = z.object(sittingOfferShape).meta({ id: "TodayFocusTest" });

export type TodayFocusTest = z.infer<typeof todayFocusTestSchema>;
