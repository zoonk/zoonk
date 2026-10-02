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

const currentUnitSchema = z
  .object({
    chapterId: z.uuid(),
    lessonsDone: z.int().min(0),
    lessonsTotal: z.int().min(0),
    position: z.int().min(1),
    title: z.string(),
    units: z.int().min(1).meta({ description: "Units in the course" }),
  })
  .nullable();

export const languageProgressViewSchema = z
  .object({
    canDo: z
      .array(z.object({ done: z.boolean(), text: z.string(), unitTitle: z.string() }))
      .meta({ description: '"I can" checks: finished units checked, the current unit\'s ahead' }),
    currentUnit: currentUnitSchema,
    goal: z.object({
      id: z.uuid(),
      targetDate: logicalDateSchema.nullable(),
      targetLanguage: z.string(),
      title: z.string(),
    }),
    levels: z.array(languageSkillLevelSchema),
    recent: z
      .object({
        conversations: z.int().min(0),
        minutesSpoken: z.int().min(0),
        wordsLearned: z.int().min(0),
      })
      .meta({ description: "The last four weeks" }),
    speakingMock: speakingMockExamSchema
      .nullable()
      .meta({
        description:
          "The exam whose speaking mock the goal offers (IELTS or TOEFL iBT, POST /v1/language-conversations with kind speakingMock); null when none",
      }),
    target: levelTargetSchema,
    wordsKnown: z
      .int()
      .min(0)
      .meta({ description: "Every word the learner has learned in this language, in total" }),
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
  skill: z.enum(LANGUAGE_MISTAKE_SKILLS).nullable(),
});

export const languageUnitViewSchema = z
  .object({
    conversation: z.object({
      character: z
        .object({ name: z.string(), role: z.string() })
        .nullable()
        .meta({ description: "Who the learner talks to, once the unit's call was written" }),
      defaultMinutes: z.int(),
      minutes: z.array(z.int()),
    }),
    goalId: z.uuid().nullable(),
    grammarTips: z.array(z.object({ text: z.string(), title: z.string() })),
    lessons: z.array(z.object({ done: z.boolean(), lessonId: z.uuid(), title: z.string() })),
    mistakes: z.array(unitMistakeSchema).meta({ description: "Open mistakes, newest first" }),
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
    currentUnit: currentUnitSchema,
    newCanDo: z
      .string()
      .nullable()
      .meta({ description: 'A new "I can" from a unit finished in the last week' }),
    pattern: z
      .object({ id: z.uuid(), kind: z.enum(["pattern", "typos"]), title: z.string() })
      .nullable()
      .meta({ description: "A pattern noticed in recent mistakes, not yet practiced" }),
    pronunciation: z
      .object({
        count: z.int().min(1),
        words: z.array(z.string()).meta({ description: "The first few, to name on the row" }),
      })
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
