import { type CourseLevel } from "@zoonk/db";
import { z } from "zod";
import { answerDurationSchema, answerTimeZoneSchema } from "../learner/contract";
import { activityAnswerSchema } from "../library/activities/activity-answer-schema";
import { activityExpectedSchema } from "../library/activities/activity-expected-answer";
import { type MaterialCitation } from "../library/sources/material-question-contract";
import { type SourceCitation } from "../library/sources/source-citation";
import { type StepContentByKind } from "../library/steps/contract/step-contract";
import { selectedAnswerSchema } from "../player/contracts/_utils/selected-answer-schema";
import { type SerializedStep } from "../player/contracts/prepare-lesson-data";
import { studyBlockCompletionSchema } from "../sessions/completion-contract";
import { progressCelebrationShape } from "../sessions/progress-celebration";
import { lessonRunIdSchema } from "./_utils/lesson-run-id";

export const MAX_TYPED_ANSWER_LENGTH = 1000;

const MAX_OPTION_ID_LENGTH = 40;
/** Leave room for malformed paths to reach semantic validation (422) instead of transport rejection (400). */
const MAX_CHALLENGE_PICKS = 10;

const typedTextSchema = z.string().trim().min(1).max(MAX_TYPED_ANSWER_LENGTH);

/** Hooks never record answers; spokenAnswer here is the typed speech fallback. */
export const lessonStepAnswerSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("check"), optionId: z.string().min(1).max(MAX_OPTION_ID_LENGTH) }),
    z.object({ kind: z.literal("typedAnswer"), text: typedTextSchema }),
    z.object({ kind: z.literal("spokenAnswer"), text: typedTextSchema }),
    z.object({ answer: activityAnswerSchema, kind: z.literal("activity") }),
    z.object({
      choiceIds: z
        .array(z.string().min(1).max(MAX_OPTION_ID_LENGTH))
        .min(1)
        .max(MAX_CHALLENGE_PICKS)
        .meta({ description: "The choice picked at each decision of a challenge, in order" }),
      kind: z.literal("challenge"),
    }),
    ...selectedAnswerSchema.options,
  ])
  .meta({ id: "LessonStepAnswer" });

export type LessonStepAnswer = z.infer<typeof lessonStepAnswerSchema>;

export const lessonStepCheckInputSchema = z
  .object({
    answer: lessonStepAnswerSchema,
    attemptId: z
      .uuid()
      .optional()
      .describe("Your id for this answer: sent again with it (a retry), it's recorded once"),
    durationMs: answerDurationSchema,
    runId: lessonRunIdSchema,
    timeZone: answerTimeZoneSchema,
    usedHelp: z
      .boolean()
      .optional()
      .meta({
        description: 'The learner saw the explanation first ("Explain first") before answering',
      }),
  })
  .strict()
  .meta({ id: "LessonStepCheckInput" });

export type LessonStepCheckInput = z.infer<typeof lessonStepCheckInputSchema>;

export const libraryLessonStartInputSchema = z
  .object({
    runId: lessonRunIdSchema
      .optional()
      .describe("Refresh this open run, including after a long pause"),
    studySessionId: z
      .uuid()
      .optional()
      .meta({
        description:
          "The session this lesson is a block of, so its answers count toward the session and continue its Hyperdrive",
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "LibraryLessonStartInput" });

export type LibraryLessonStartInput = z.infer<typeof libraryLessonStartInputSchema>;

export type TeachingStepKind =
  | "activity"
  | "challenge"
  | "check"
  | "explanation"
  | "hook"
  | "spokenAnswer"
  | "summary"
  | "typedAnswer"
  | "workedExample";

type LanguageExerciseKind = SerializedStep["kind"];

/** id identifies the media asset, not the step, so picture votes reach the image. */
export type PlayableStepImage = {
  alt: string;
  height: number | null;
  id: string;
  url: string;
  width: number | null;
};

/** optionId identifies an option picture; omitted means the screen's main picture. */
export type LessonPicture = { image: PlayableStepImage; optionId?: string; stepId: string };

type PlayableStepBase = { id: string; position: number; skillId: string | null };

export type LessonStepCitation =
  | (MaterialCitation & { kind: "material" })
  | (SourceCitation & { kind: "source" })
  | { kind: "notInMaterial" };

export type PlayableTeachingStepOf<TKind extends TeachingStepKind> = PlayableStepBase & {
  citation: LessonStepCitation | null;
  content: StepContentByKind[TKind];
  image: PlayableStepImage | null;
  /** Wait for getLessonPictures while a requested screen picture is still being drawn. */
  imagePending: boolean;
  /** Original screen-generation time in epoch milliseconds; reopening does not restart its wait. */
  pictureWaitStartedAt?: number;
  kind: TKind;
  /** Missing option pictures must fall back to their descriptions. */
  optionPictures?: Readonly<Record<string, PlayableStepImage>>;
};

/** Null listening means this screen has no sentence-backed fallback. */
export type PlayableSpokenAnswerStep = PlayableTeachingStepOf<"spokenAnswer"> & {
  listening: SerializedStep | null;
};

type OtherTeachingStepKind = Exclude<TeachingStepKind, "spokenAnswer">;

export type PlayableTeachingStep =
  | PlayableSpokenAnswerStep
  | { [TKind in OtherTeachingStepKind]: PlayableTeachingStepOf<TKind> }[OtherTeachingStepKind];

export type PlayableWordHints = { note: string | null; pronunciationTip: string | null };

export type PlayableLanguageStep = PlayableStepBase & {
  exercise: SerializedStep;
  kind: LanguageExerciseKind;
  /** Only on vocabulary and translation screens whose word has a note or a tip. */
  wordHints: PlayableWordHints | null;
};

export type PlayableLibraryStep = PlayableLanguageStep | PlayableTeachingStep;

export type PlayableLibraryLesson = {
  canDo: string | null;
  chapter: { id: string; title: string } | null;
  description: string;
  estimatedMinutes: number;
  id: string;
  language: string;
  level: CourseLevel;
  skills: { id: string; name: string }[];
  steps: PlayableLibraryStep[];
  summaryIdeas: string[];
  targetLanguage: string | null;
  title: string;
};

const lessonSupportSchema = z
  .enum(["explanationFirst", "questionFirst"])
  .meta({
    description:
      "`explanationFirst` when the learner never answered the skill the lesson opens with; `questionFirst` when they have. Reorder only the lesson's opening: move the explanations after the first question in front of it, or the first question after the opening explanations in front of them",
    id: "LessonSupport",
  });

export type LessonSupport = z.infer<typeof lessonSupportSchema>;

/** Answers are ordered by arrival. */
const lessonRunAnswerSchema = z.object({
  answeredAt: z.iso
    .datetime()
    .meta({ description: "Before the run's `startedAt` for an answer from an earlier sitting" }),
  isCorrect: z.boolean(),
  stepId: z.uuid(),
});

export const libraryLessonRunSchema = z
  .object({
    answers: z
      .array(lessonRunAnswerSchema)
      .meta({
        description:
          "The lesson's answers so far, oldest first: this run's and those of earlier sittings the learner left unfinished in the last week (since they last finished the lesson). The lesson continues after the screens they answered, each counting with its first answer, and a check missed once comes back at the end. Hyperdrive replays only this run's answers (`answeredAt` at or after `startedAt`) on top of `hyperdrive`",
      }),
    hyperdrive: z
      .object({
        knownStepIds: z
          .array(z.uuid())
          .meta({
            description:
              "Screens answered right before this run: a right answer on them doesn't build Hyperdrive",
          }),
        streak: z
          .int()
          .min(0)
          .meta({
            description: "Right answers in a row in the session before this run, 0 outside one",
          }),
      })
      .meta({
        description:
          "Where Hyperdrive stood when the run started, to show it live with the server's rule (a resumed run replays its `answers` on top)",
      }),
    optionalStepIds: z.array(z.uuid()).optional().describe("Questions with late numbered pictures"),
    runId: z.uuid().meta({ description: "Send it with every answer and with the completion" }),
    startedAt: z.iso.datetime(),
    support: lessonSupportSchema.nullable().describe("Lesson opening; null keeps its order"),
  })
  .meta({ id: "LibraryLessonRun" });

export type LibraryLessonRun = z.infer<typeof libraryLessonRunSchema>;

export const lessonStepCheckResultSchema = z
  .object({
    checked: z
      .boolean()
      .meta({
        description:
          "False for a typed answer that wasn't checked: past a few graded answers to the same screen a day, code still recognizes an accepted answer, and anything else is shown with the sample answer (`correctAnswer`) as not checked, not as wrong. It isn't recorded and saves no mistake. True otherwise.",
      }),
    correctAnswer: z.string().nullable().meta({ description: "The right answer when missed" }),
    corrections: z
      .array(
        z.object({
          right: z.string().meta({ description: "The same words written correctly" }),
          wrong: z.string().meta({ description: "The learner's words as they wrote them" }),
        }),
      )
      .meta({
        description:
          "A typed answer in a language course: each form mistake (a wrong word, gender, number, tense or agreement), which keeps the answer from being right even when every key point is met. A sentence typed instead of said that misses: one correction, the sentence as typed and as it reads. Empty otherwise.",
      }),
    expected: activityExpectedSchema
      .nullable()
      .meta({
        description:
          "An activity's correct answer, computed by the code that graded it, to draw next to the learner's answer: the right option, the number or the canvas's end state. Null for other screens, and for an activity whose template computes none",
      }),
    feedback: z
      .string()
      .nullable()
      .meta({
        description:
          "Why: the chosen option's reason, the grader's feedback or the check's explanation",
      }),
    isCorrect: z.boolean(),
    keyPoints: z
      .array(z.object({ met: z.boolean(), text: z.string() }))
      .nullable()
      .meta({
        description:
          "Each key point of a typed answer and whether the answer stated it, judged by meaning",
      }),
    nextReviewAt: z.iso
      .datetime()
      .nullable()
      .meta({ description: "When the skill behind the screen comes back for review" }),
    savedMistake: z.boolean().meta({ description: "A wrong answer went to the mistakes notebook" }),
    score: z
      .number()
      .min(0)
      .max(1)
      .nullable()
      .meta({
        description: "Partial credit from 0 to 1 for typed and spoken answers and challenges",
      }),
    spelling: z
      .string()
      .nullable()
      .meta({
        description:
          "A typed answer that was right apart from a typo: the right spelling to show. A typo isn't a mistake.",
      }),
  })
  .meta({ id: "LessonStepCheckResult" });

export type LessonStepCheckResult = z.infer<typeof lessonStepCheckResultSchema>;

export const libraryLessonCompletionSchema = z
  .object({
    // Session lessons celebrate in studyBlock's moment, so completion itself reaches nothing.
    ...progressCelebrationShape,
    brainPower: z.int(),
    correctCount: z.int().min(0),
    energyDelta: z.number(),
    incorrectCount: z.int().min(0),
    isFirstCompletion: z
      .boolean()
      .meta({
        description: "False for a replay: it completes, but doesn't count as a new lesson learned",
      }),
    nextReviewAt: z.iso
      .datetime()
      .nullable()
      .meta({ description: "When the lesson's skills come back for review, the earliest first" }),
    seconds: z.int().min(0),
    studyBlock: studyBlockCompletionSchema
      .nullable()
      .meta({
        description: "The session block's moment, when the lesson was one of today's blocks",
      }),
    totalBrainPower: z.number(),
  })
  .meta({ id: "LibraryLessonCompletion" });

export type LibraryLessonCompletion = z.infer<typeof libraryLessonCompletionSchema>;

export const answerExplanationInputSchema = z
  .object({
    answer: z
      .string()
      .trim()
      .min(1)
      .max(MAX_TYPED_ANSWER_LENGTH)
      .meta({ description: "The learner's wrong typed answer" }),
  })
  .strict()
  .meta({ id: "AnswerExplanationRequest" });

export const answerExplanationSchema = z
  .object({
    explanation: z.string(),
    explanationId: z.uuid().meta({ description: "The answer explanation this feedback is about" }),
    reused: z
      .boolean()
      .meta({ description: "Another learner gave the same answer before, so no model ran" }),
  })
  .meta({ id: "AnswerExplanation" });
