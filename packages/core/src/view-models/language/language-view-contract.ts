import { MAX_CEFR_SCORE } from "@zoonk/utils/cefr";
import { z } from "zod";
import { speakingMockExamSchema } from "../../language/conversations/conversation-contract";
import { LANGUAGE_SKILLS } from "../../language/levels/skill-level-rules";

const logicalDateSchema = z.iso.date();

const languageSkillLevelSchema = z
  .object({
    label: z.string().meta({ description: 'The CEFR level, "A2" or "A2+"' }),
    score: z
      .number()
      .min(0)
      .max(MAX_CEFR_SCORE)
      .meta({ description: "Half steps from A1 (0) to C2 (5)" }),
    skill: z.enum(LANGUAGE_SKILLS),
    startLabel: z.string().meta({ description: "The level at the level test" }),
    trend: z.enum(["up", "same", "down"]).meta({ description: "Since the level test" }),
  })
  .meta({ id: "LanguageSkillLevel" });

const levelTargetSchema = z
  .object({ label: z.string(), score: z.number().min(0).max(MAX_CEFR_SCORE) })
  .nullable()
  .meta({ description: "The level the learner aims for, when they gave one" });

export const languageProgressViewSchema = z
  .object({
    canDo: z
      .array(z.object({ done: z.boolean(), text: z.string(), unitTitle: z.string() }))
      .meta({ description: '"I can" checks: finished units checked, the current unit\'s ahead' }),
    goal: z.object({
      id: z.uuid(),
      targetDate: logicalDateSchema.nullable(),
      targetLanguage: z.string(),
      title: z.string(),
    }),
    level: z
      .string()
      .nullable()
      .meta({
        description:
          'The level across skills ("A2+"): their average, rounded down to a half step; null before any',
      }),
    levels: z.array(languageSkillLevelSchema),
    speakingMock: speakingMockExamSchema
      .nullable()
      .meta({
        description:
          "The exam whose speaking mock the goal offers (IELTS or TOEFL iBT, POST /v1/language-conversations with kind speakingMock); null when none",
      }),
    target: levelTargetSchema,
  })
  .meta({ id: "LanguageProgress" });

export type LanguageProgressView = z.infer<typeof languageProgressViewSchema>;

export const LANGUAGE_MISTAKE_SKILLS = ["words", "listening", "speaking", "writing"] as const;

export type LanguageMistakeSkill = (typeof LANGUAGE_MISTAKE_SKILLS)[number];

const unitMistakeSchema = z.object({
  answer: z.string().nullable(),
  correctAnswer: z.string().nullable(),
  explanation: z.string().nullable(),
  id: z.uuid(),
  question: z.string(),
  skill: z.enum(LANGUAGE_MISTAKE_SKILLS),
});

/** A pattern noticed in the learner's mistakes; its page explains it and has a short drill. */
const noticedPatternSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["pattern", "typos"]),
  title: z.string(),
});

/** Mispronounced words due to be said again today, named by the first few. */
const duePronunciationSchema = z.object({
  count: z.int().min(1),
  words: z.array(z.string()).meta({ description: "The first few, to name on the row" }),
});

/** A unit's practice call as it's offered: who the learner talks to and the lengths to pick. */
export const practiceCallSchema = z
  .object({
    character: z
      .object({ name: z.string(), role: z.string() })
      .nullable()
      .meta({ description: "Who the learner talks to, once the unit's call was written" }),
    defaultMinutes: z.int(),
    limit: z
      .object({
        period: z.enum(["day", "month", "total"]),
        tier: z.enum(["free", "guest", "plus"]),
      })
      .nullable()
      .meta({
        description:
          "When no length fits: the call time that's used (today's, this month's, or a guest's plan without calls), to say until when calls come back. Never show how much call time a plan has",
      }),
    minutes: z
      .array(z.int())
      .meta({ description: "The lengths that fit what's left of the learner's call time" }),
    plusMinutes: z
      .array(z.int())
      .meta({ description: "Longer lengths that come with Plus, shown locked with the Plus mark" }),
  })
  .meta({ id: "LanguagePracticeCall" });

export const languageUnitViewSchema = z
  .object({
    conversation: practiceCallSchema,
    goalId: z.uuid().nullable(),
    grammarTips: z.array(z.object({ text: z.string(), title: z.string() })),
    lessons: z
      .array(
        z.object({
          done: z.boolean(),
          lessonId: z.uuid(),
          minutes: z.int().min(0),
          title: z.string(),
          written: z
            .boolean()
            .meta({
              description:
                "Its screens are written, so opening it starts no writing and apps may load it ahead",
            }),
        }),
      )
      .meta({ description: "In teaching order; the first not done is the one to open next" }),
    mistakes: z.array(unitMistakeSchema).meta({ description: "Open mistakes, newest first" }),
    pattern: noticedPatternSchema
      .nullable()
      .meta({
        description:
          "A pattern noticed in this unit's mistakes in the last week, not practiced or dismissed yet",
      }),
    pronunciation: duePronunciationSchema
      .nullable()
      .meta({ description: "Mispronounced words in the language due to be said again today" }),
    summaries: z
      .array(z.object({ ideas: z.array(z.string()), lessonId: z.uuid(), title: z.string() }))
      .meta({ description: "Summary cards of the unit's finished lessons, in lesson order" }),
    unit: z.object({
      chapterId: z.uuid(),
      description: z.string(),
      levelRange: z.string().meta({ description: 'The CEFR bands it teaches, "A1–A2"' }),
      objectives: z.array(z.string()),
      position: z.int().min(1).nullable(),
      title: z.string(),
    }),
    words: z.object({ count: z.int().min(0), sample: z.array(z.string()) }),
  })
  .meta({ id: "LanguageUnit" });

export type LanguageUnitView = z.infer<typeof languageUnitViewSchema>;

export const languageTodayViewSchema = z
  .object({
    level: z
      .object({
        label: z.string().meta({ description: 'The level across skills, "A2+"' }),
        target: z
          .string()
          .nullable()
          .meta({ description: "The level the learner aims for, when they gave one" }),
      })
      .nullable()
      .meta({
        description:
          "The level across skills (their average, rounded down to a half step), shown instead of preparation",
      }),
    pattern: noticedPatternSchema
      .nullable()
      .meta({ description: "A pattern noticed in recent mistakes, not yet practiced" }),
    pronunciation: duePronunciationSchema
      .nullable()
      .meta({ description: "Mispronounced words due to be said again today" }),
  })
  .meta({ id: "LanguageToday" });

export type LanguageTodayView = z.infer<typeof languageTodayViewSchema>;

export const languageUnitsViewSchema = z
  .object({
    alphabet: z
      .object({
        canDo: z.string().nullable(),
        lessonId: z.uuid().meta({ description: "Open it anytime to practice the letters" }),
        minutes: z.int().min(0),
        pending: z
          .boolean()
          .meta({
            description:
              "The learner's sessions still open with it: not finished, not skipped, and the level test didn't show they read the script",
          }),
        title: z.string(),
      })
      .nullable()
      .meta({
        description:
          "The alphabet lesson of a language whose script isn't Latin, once written; null otherwise",
      }),
    goalId: z.uuid(),
    units: z.array(
      z.object({
        chapterId: z.uuid(),
        done: z.boolean().meta({ description: "Every lesson done, or a call for the unit won" }),
        lessonsDone: z.int().min(0),
        lessonsTotal: z.int().min(0),
        position: z.int().min(1),
        title: z.string(),
      }),
    ),
  })
  .meta({ id: "LanguageUnits" });

export type LanguageUnitsView = z.infer<typeof languageUnitsViewSchema>;
