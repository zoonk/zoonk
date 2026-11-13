import { type GoalKind } from "@zoonk/db/enums";
import { CEFR_LEVELS, MAX_CEFR_SCORE } from "@zoonk/utils/cefr";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { speechClipSchema } from "../../audio/speech-clip-contract";
import { answerDurationSchema } from "../../learner/contract";
import { LANGUAGE_SKILLS } from "../levels/skill-level-rules";

const OPTIONS = 4;

const questionSkillSchema = z.enum(["reading", "listening"]);

const levelTestQuestionSchema = z.object({
  answerIndex: z
    .int()
    .min(0)
    .max(OPTIONS - 1),
  id: z.string(),
  level: z.enum(CEFR_LEVELS),
  options: z.array(z.string()).length(OPTIONS),
  passage: z.string(),
  question: z.string(),
  skill: questionSkillSchema,
});

export const levelTestBankSchema = z.object({
  questions: z.array(levelTestQuestionSchema),
  speaking: z.array(
    z.object({ level: z.enum(CEFR_LEVELS), sentence: z.string(), translation: z.string() }),
  ),
});

export type LevelTestQuestion = z.infer<typeof levelTestQuestionSchema>;
export type LevelTestBank = z.infer<typeof levelTestBankSchema>;

export const levelTestAnswerSchema = z.object({
  answerIndex: z
    .int()
    .min(0)
    .max(OPTIONS - 1)
    .nullable(),
  /**
   * The verdict when it was given, null for "I don't know": a later fix to the key never re-scores
   * it. Answers saved before verdicts were kept have none and are graded by the key.
   */
  correct: z.boolean().nullable().optional(),
  durationMs: z.int().min(0).default(0),
  id: z.string(),
  skipped: z.boolean().optional(),
});

export const levelTestProgressSchema = z.object({
  answers: z.array(levelTestAnswerSchema).default([]),
  counted: z.int().min(0).default(0),
  placement: z
    .object({
      pastBasicsAreas: z.array(z.string()).default([]),
      placed: z.boolean(),
      unannounced: z.array(z.string()).default([]),
    })
    .optional(),
  /** The test's row in `anonymous_level_tests`, made on its first answer. */
  recordId: uuidSchema().optional(),
  /** The levels a finish set. A bank check can later remove an answered question; they stay. */
  scores: z
    .object({ listening: z.number(), reading: z.number(), speaking: z.number().optional() })
    .optional(),
  /**
   * The fixed sentence a take excused by a fix showed next. Takes of it are scored; a later fix to
   * it excuses one more take.
   */
  shownFixedSentence: z.string().optional(),
  speaking: z
    .object({ level: z.enum(CEFR_LEVELS), score: z.number().min(0).max(1) })
    .nullable()
    .default(null),
  start: z.number().min(0).max(MAX_CEFR_SCORE).optional(),
  /** When the first answer arrived; a fix to the bank after it never costs this test. */
  startedAt: z.iso.datetime().optional(),
});

export type LevelTestProgress = z.infer<typeof levelTestProgressSchema> & { start: number };

export const levelTestAnswerInputSchema = z
  .object({
    answerIndex: z
      .int()
      .min(0)
      .max(OPTIONS - 1)
      .nullable()
      // Generated clients (the iOS app's) drop a nil property instead of sending null.
      .default(null)
      .meta({ description: 'The option chosen, or null for "I don\'t know"' }),
    durationMs: answerDurationSchema
      .optional()
      .meta({
        description:
          "Milliseconds from showing the question to the answer, which count toward the learner's study time; anything over an hour counts as an hour",
      }),
    questionId: z.string().min(1),
    skipped: z
      .boolean()
      .optional()
      .meta({
        description:
          "Skips a listening question whose audio couldn't be made; it doesn't count toward a level",
      }),
  })
  .strict()
  .meta({ id: "LanguageLevelTestAnswerInput" });

export type LevelTestAnswerInput = z.infer<typeof levelTestAnswerInputSchema>;

const questionViewSchema = z.object({
  audio: speechClipSchema
    .nullable()
    .meta({
      description:
        "For listening, the message's recording; null while it's being made (audioPending) or when it couldn't be: then ask for it with POST /speech-clips when the learner plays it",
    }),
  audioPending: z
    .boolean()
    .meta({
      description:
        "The listening message's recording is still being made: read the test again in a few seconds",
    }),
  id: z.string(),
  level: z.enum(CEFR_LEVELS),
  options: z.array(z.string()),
  passage: z.string().meta({ description: "For listening, the message the app reads aloud" }),
  question: z.string(),
  skill: questionSkillSchema,
});

const speakingViewSchema = z.object({
  level: z.enum(CEFR_LEVELS),
  sentence: z.string(),
  translation: z.string(),
});

const levelResultSchema = z.object({
  label: z.string(),
  score: z.number().min(0).max(MAX_CEFR_SCORE),
  skill: z.enum(LANGUAGE_SKILLS),
});

export const LEVEL_TEST_PREPARING_SECONDS = 120;

/** Three reading and three listening questions and one sentence out loud. */
export const LEVEL_TEST_MINUTES = 3;

const PLACEMENT_MINUTES = 2;

/** How long the level question's quick test takes: a language goal's is its level test. */
export function getQuickTestMinutes(kind: GoalKind): number {
  return kind === "language" ? LEVEL_TEST_MINUTES : PLACEMENT_MINUTES;
}

export const languageLevelTestViewSchema = z
  .discriminatedUnion("status", [
    z.object({
      expectedSeconds: z
        .int()
        .min(1)
        .meta({ description: "How long writing a pair's questions usually takes" }),
      showAlphabetNote: z.boolean(),
      startedAt: z.iso
        .datetime()
        .nullable()
        .meta({
          description:
            "When the run writing the pair's questions started; null when nothing is writing them (none started, or it failed): start it with POST /goals/{goalId}/language-level-test/generations. Only the first learner of a language pair waits",
        }),
      status: z.literal("preparing"),
    }),
    z.object({
      answered: z.int().min(0),
      lastCorrect: z.boolean().nullable(),
      levels: z
        .array(levelResultSchema)
        .meta({
          description:
            "The levels so far. Speaking has one only after the sentence out loud; writing, which the test can't ask, has none until lessons' typed answers give it one",
        }),
      next: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("question"), question: questionViewSchema }),
        z.object({ kind: z.literal("speaking"), speaking: speakingViewSchema }),
        z.object({ kind: z.literal("done") }),
      ]),
      showAlphabetNote: z.boolean(),
      status: z.literal("ready"),
      targetLanguage: z.string(),
      total: z.int().min(1).meta({ description: "Questions and sentences the test asks at most" }),
    }),
  ])
  .meta({ id: "LanguageLevelTest" });

export type LanguageLevelTestView = z.infer<typeof languageLevelTestViewSchema>;
