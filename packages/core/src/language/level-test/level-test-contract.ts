import { CEFR_LEVELS, MAX_CEFR_SCORE } from "@zoonk/utils/cefr";
import { z } from "zod";
import { answerDurationSchema } from "../../learner/contract";
import { LANGUAGE_SKILLS } from "../levels/skill-level-rules";

const OPTIONS = 4;

const questionSkillSchema = z.enum(["reading", "listening"]);

/** One stored question of a pair's level test, with its right answer. */
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

/** One answer given in the test; null means "I don't know". */
const levelTestAnswerSchema = z.object({
  answerIndex: z
    .int()
    .min(0)
    .max(OPTIONS - 1)
    .nullable(),
  /** How long it took, for study time; 0 on answers kept before durations were. */
  durationMs: z.int().min(0).default(0),
  id: z.string(),
});

/** What the goal keeps while the learner takes the test. */
export const levelTestProgressSchema = z.object({
  answers: z.array(levelTestAnswerSchema).default([]),
  /** The answers already counted toward the learner's study time, when the test ended. */
  counted: z.int().min(0).default(0),
  speaking: z
    .object({ level: z.enum(CEFR_LEVELS), score: z.number().min(0).max(1) })
    .nullable()
    .default(null),
});

export type LevelTestProgress = z.infer<typeof levelTestProgressSchema>;

export const levelTestAnswerInputSchema = z
  .object({
    answerIndex: z
      .int()
      .min(0)
      .max(OPTIONS - 1)
      .nullable()
      .meta({ description: 'The option chosen, or null for "I don\'t know"' }),
    durationMs: answerDurationSchema
      .optional()
      .meta({
        description:
          "Milliseconds from showing the question to the answer, which count toward the learner's study time; anything over an hour counts as an hour",
      }),
    questionId: z.string().min(1),
  })
  .strict()
  .meta({ id: "LanguageLevelTestAnswerInput" });

export type LevelTestAnswerInput = z.infer<typeof levelTestAnswerInputSchema>;

const questionViewSchema = z.object({
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

/** Writing a pair's questions takes about 80 seconds, a hundred at the slowest (eval, 28 Sep). */
export const LEVEL_TEST_PREPARING_SECONDS = 120;

export const languageLevelTestViewSchema = z
  .discriminatedUnion("status", [
    z.object({
      expectedSeconds: z
        .int()
        .min(1)
        .meta({ description: "How long writing a pair's questions usually takes" }),
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
      /** Right after an answer: whether it was right; null before the first. */
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
      status: z.literal("ready"),
      targetLanguage: z.string(),
      total: z.int().min(1).meta({ description: "Questions and sentences the test asks at most" }),
    }),
  ])
  .meta({ id: "LanguageLevelTest" });

export type LanguageLevelTestView = z.infer<typeof languageLevelTestViewSchema>;
