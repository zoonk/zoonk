import { z } from "zod";
import { planChangeSchema } from "../../plans/plan-change-contract";
import { answerTimeZoneSchema } from "../contract";

/** The `source` of the plan changes the test proposes. */
export const FOCUS_TEST_SOURCE = "focusTest";

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
    .meta({ description: "What learners call it, when that differs from `name`" }),
};

const focusTestSubjectSchema = z
  .object({
    ...subjectNameShape,
    asked: countSchema.meta({
      description: "All test responses on the subject, including `dontKnow`",
    }),
    dontKnow: countSchema.meta({
      description:
        "Responses marked dontKnow: true; excluded from grading. Chosen answers = asked - dontKnow. All responses are unknown when asked > 0 and dontKnow = asked",
    }),
    part: uncheckedPartSchema.nullable().meta({ description: "Set only for `notChecked`" }),
    right: countSchema.meta({ description: "Correct chosen answers, out of `asked - dontKnow`" }),
    state: z
      .enum(["answered", "notAsked", "notChecked"])
      .meta({
        description:
          "`answered`: at least one response; grade only chosen answers (`asked - dontKnow`), distinguishing all-unknown responses (`dontKnow = asked`). `notAsked`: no test answer yet, or no question is ready for it. `notChecked`: a part this test can't ask about (`part`)",
      }),
  })
  .meta({ id: "FocusTestSubject" });

export type FocusTestSubject = z.infer<typeof focusTestSubjectSchema>;

const focusTestSittingSchema = z
  .object({
    answered: countSchema.meta({ description: "Answers given in this sitting" }),
    hint: z
      .enum(["manyUnknown"])
      .nullable()
      .meta({
        description: '`manyUnknown`: the last five answers in a row were "I don\'t know yet"',
      }),
    minutes: countSchema.meta({
      description: "About how long the questions it has left take at the learner's pace",
    }),
    questions: countSchema.meta({
      description: "The most questions this sitting asks, fixed when it started",
    }),
    subject: z
      .object(subjectNameShape)
      .nullable()
      .meta({ description: "The subject `next` asks about; null when there is no `next`" }),
  })
  .meta({ id: "FocusTestSitting" });

export type FocusTestSitting = z.infer<typeof focusTestSittingSchema>;

const offerShape = {
  minutes: countSchema.meta({
    description: "About how long its questions take at the learner's pace",
  }),
};

const focusTestOfferSchema = z.object(offerShape).meta({ id: "FocusTestOffer" });

export type FocusTestOffer = z.infer<typeof focusTestOfferSchema>;

const focusRowSchema = z
  .object({
    areas: z.array(z.string()).meta({ description: "The plan areas that study the subject" }),
    subject: z.object(subjectNameShape),
  })
  .meta({ id: "FocusTestFocusRow" });

export type FocusRow = z.infer<typeof focusRowSchema>;

const focusTestFocusSchema = z
  .object({
    proposal: planChangeSchema
      .nullable()
      .meta({ description: "For `proposed`: the change to apply or decline, with its effect" }),
    rows: z
      .array(focusRowSchema)
      .meta({
        description:
          "The subjects to give more time, up to three, the most needed first. For `proposed`, the subjects the waiting `proposal` gives more time, which may differ from what the test would suggest now",
      }),
    state: z
      .enum(["ifTimeShort", "proposed", "current", "handPicked", "declined", "suggested"])
      .meta({
        description:
          "Read from the plan's focus and the test's own plan changes. `ifTimeShort`: the plan isn't shown yet; saving a daily time that doesn't cover everything sets this focus. `proposed`: `proposal` waits for the learner's answer. `current`: the plan's focus areas match these subjects. `handPicked`: the plan has a focus the learner chose. `declined`: the learner dismissed a proposal of these subjects with Not now or Undo, and the plan has no focus of their own; the test never proposes them again. `suggested`: the rows alone, with no claim about the plan",
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
          "Where the plan should give more time. Null without a date, with one subject, or on a shown plan whose time covers everything",
      }),
    lessonsSkipped: countSchema.meta({
      description:
        "The plan's lessons the answers so far skip; 0 when subjects start from the basics for now",
    }),
  })
  .meta({ id: "FocusTestCheckpoint" });

const suggestsFocusSchema = z
  .boolean()
  .meta({
    description:
      "The goal has a date and more than one subject, so the test's answers also say where to focus. Without it they only set where each subject starts",
  });

const SESSION_QUESTIONS = ["off", "on", "paused", "skippedToday"] as const;

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
    offer: focusTestOfferSchema
      .nullable()
      .meta({
        description:
          "The sitting POST .../placement/sittings would open, or the open one before its first answer; null once the open sitting has an answer and when nothing is left to ask",
      }),
    sessionQuestions: sessionQuestionsSchema,
    sitting: focusTestSittingSchema
      .nullable()
      .meta({
        description:
          "The open sitting. Once the placement's `status` is `done` it asks nothing more, whatever is left of its `questions`, and POST .../placement/completion closes it",
      }),
    subjects: z
      .array(focusTestSubjectSchema)
      .meta({ description: "Every subject, in the notice's order" }),
    suggestsFocus: suggestsFocusSchema,
  })
  .meta({ id: "FocusTest" });

export type FocusTestView = z.infer<typeof focusTestViewSchema>;

export const focusTestSummarySchema = z
  .object({
    offer: focusTestOfferSchema
      .nullable()
      .meta({
        description:
          "`notStarted`: the first sitting. `sitting`: what's left of the open one. `checked`: a further sitting. Null when nothing is left to ask",
      }),
    sessionQuestions: sessionQuestionsSchema,
    state: z
      .enum(["notStarted", "sitting", "checked"])
      .meta({
        description:
          "`sitting`: a sitting is open with questions left. `checked`: the learner has test answers and no sitting open",
      }),
    suggestsFocus: suggestsFocusSchema,
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

export const todayFocusTestSchema = z.object(offerShape).meta({ id: "TodayFocusTest" });

export type TodayFocusTest = z.infer<typeof todayFocusTestSchema>;
