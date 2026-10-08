import { type CourseLevel } from "@zoonk/db";
import { z } from "zod";
import { answerDurationSchema, answerTimeZoneSchema } from "../learner/contract";
import { activityAnswerSchema } from "../library/activities/activity-answer-schema";
import { type MaterialCitation } from "../library/sources/material-question-contract";
import { type SourceCitation } from "../library/sources/source-citation";
import { type StepContentByKind } from "../library/steps/contract/step-contract";
import { selectedAnswerSchema } from "../player/contracts/_utils/selected-answer-schema";
import { type SerializedStep } from "../player/contracts/prepare-lesson-data";
import { studyBlockCompletionSchema } from "../sessions/completion-contract";

/**
 * Stable error codes of the lesson endpoints, so the player (web or native) reacts to each one
 * (a calm wait, a sign-up or upgrade prompt, a fresh start) without parsing messages.
 */
export const LESSON_PLAYER_ERROR_CODES = {
  lessonSetAside: "LESSON_SET_ASIDE",
  noSpeech: "NO_SPEECH",
  runEnded: "LESSON_RUN_ENDED",
  slowDown: "SLOW_DOWN",
  usageLimitReached: "USAGE_LIMIT_REACHED",
} as const;

/** Typed and spoken answers are a few sentences; the grader and the shared explanations share it. */
export const MAX_TYPED_ANSWER_LENGTH = 1000;

const MAX_OPTION_ID_LENGTH = 40;
/** A challenge path is 2 to 4 decisions; a little room keeps a malformed path a 422, not a 400. */
const MAX_CHALLENGE_PICKS = 10;

const typedTextSchema = z.string().trim().min(1).max(MAX_TYPED_ANSWER_LENGTH);

/**
 * What the learner answered on one lesson screen. A hook's guess never counts, so it has no
 * answer; `spokenAnswer` here is the typed fallback of a spoken answer.
 */
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

const runIdSchema = z
  .uuid()
  .meta({ description: "The lesson run returned by the start, which answers count toward" });

export const lessonStepCheckInputSchema = z
  .object({
    answer: lessonStepAnswerSchema,
    durationMs: answerDurationSchema,
    runId: runIdSchema,
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

export const libraryLessonCompletionInputSchema = z
  .object({ runId: runIdSchema, timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "LibraryLessonCompletionInput" });

export type LibraryLessonCompletionInput = z.infer<typeof libraryLessonCompletionInputSchema>;

/** Screens that teach and check an idea. Everything else is a language exercise. */
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

/** Language exercises play through the exercise components with their word banks and options. */
type LanguageExerciseKind = SerializedStep["kind"];

/**
 * A step's image, with its size so the page reserves its space before it loads. `id` is its media
 * asset, so a vote on the image reaches the image rather than the screen.
 */
export type PlayableStepImage = {
  alt: string;
  height: number | null;
  id: string;
  url: string;
  width: number | null;
};

/** A screen's picture drawn after the lesson was read, for the player to show as it arrives. */
export type LessonPicture = { image: PlayableStepImage; stepId: string };

type PlayableStepBase = {
  id: string;
  position: number;
  /** The skill this screen teaches or checks, so answers update the right memory. */
  skillId: string | null;
};

/**
 * Where a screen comes from: a page of the learner's own material ("Aula 5, slide 4") for lessons
 * built from it, or a public document its facts come from (a law, an exam notice), shown as a
 * dated "Sources" chip.
 */
/**
 * Where a screen came from: a page of the learner's own material, a public source, or, for an
 * explanation in a lesson built from the learner's material that no page of it supports,
 * `notInMaterial`, so the learner knows it goes beyond their slides.
 */
export type LessonStepCitation =
  | (MaterialCitation & { kind: "material" })
  | (SourceCitation & { kind: "source" })
  | { kind: "notInMaterial" };

export type PlayableTeachingStepOf<TKind extends TeachingStepKind> = PlayableStepBase & {
  citation: LessonStepCitation | null;
  content: StepContentByKind[TKind];
  image: PlayableStepImage | null;
  /**
   * The screen asks for a picture that is still being drawn: the lesson was written moments ago.
   * The player waits on it (`getLessonPictures`) instead of showing the screen without it.
   */
  imagePending: boolean;
  kind: TKind;
};

/**
 * A "say it out loud" screen. `listening` is the same sentence as a listening exercise (hear it,
 * build it from a word bank), swapped in when the learner can't talk now; null when the screen
 * has no sentence of the lesson behind it.
 */
export type PlayableSpokenAnswerStep = PlayableTeachingStepOf<"spokenAnswer"> & {
  listening: SerializedStep | null;
};

type OtherTeachingStepKind = Exclude<TeachingStepKind, "spokenAnswer">;

export type PlayableTeachingStep =
  | PlayableSpokenAnswerStep
  | { [TKind in OtherTeachingStepKind]: PlayableTeachingStepOf<TKind> }[OtherTeachingStepKind];

/** What a word screen adds for this language pair: a false friend or usage trap, and a sound tip. */
export type PlayableWordHints = { note: string | null; pronunciationTip: string | null };

/** A language exercise in the shape today's exercise components render and today's code checks. */
export type PlayableLanguageStep = PlayableStepBase & {
  exercise: SerializedStep;
  kind: LanguageExerciseKind;
  /** Only on vocabulary and translation screens whose word has a note or a tip. */
  wordHints: PlayableWordHints | null;
};

export type PlayableLibraryStep = PlayableLanguageStep | PlayableTeachingStep;

/**
 * A Library lesson as the player needs it: public content only, the same for every viewer, with
 * image URLs resolved.
 */
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
  /** The summary card, each idea in one sentence: saved to Content and one tap away in the menu. */
  summaryIdeas: string[];
  targetLanguage: string | null;
  title: string;
};

/**
 * How the lesson opens for this learner: new skills start with the explanation, partly known ones
 * with a question first (the explanation follows and "Explain first" stays available).
 */
const lessonSupportSchema = z
  .enum(["explanationFirst", "questionFirst"])
  .meta({
    description:
      "`explanationFirst` when the learner never answered the skill the lesson opens with; `questionFirst` when they have. Reorder only the lesson's opening: move the explanations after the first question in front of it, or the first question after the opening explanations in front of them",
    id: "LessonSupport",
  });

export type LessonSupport = z.infer<typeof lessonSupportSchema>;

/** One answer the lesson already has, in the order the learner gave them. */
const lessonRunAnswerSchema = z.object({
  answeredAt: z.iso
    .datetime()
    .meta({ description: "Before the run's `startedAt` for an answer from an earlier sitting" }),
  isCorrect: z.boolean(),
  stepId: z.uuid(),
});

/** One started run of a lesson. Answers and the completion refer to it. */
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
    runId: z.uuid().meta({ description: "Send it with every answer and with the completion" }),
    startedAt: z.iso.datetime(),
    support: lessonSupportSchema
      .nullable()
      .meta({ description: "How the lesson opens for this learner; null keeps its own order" }),
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
          "A typed answer in a language course: each form mistake (a wrong word, gender, number, tense or agreement), which keeps the answer from being right even when every key point is met. Empty otherwise.",
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
    explanationId: z
      .uuid()
      .meta({ description: "Vote on it at /me/content-votes/answerExplanation/{explanationId}" }),
    reused: z
      .boolean()
      .meta({ description: "Another learner gave the same answer before, so no model ran" }),
  })
  .meta({ id: "AnswerExplanation" });
