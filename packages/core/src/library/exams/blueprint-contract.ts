import { numericEntrySchema, optionSelectSchema } from "@zoonk/ai/tasks/v2/items/schemas";
import { partialCreditSchema } from "@zoonk/ai/tasks/v2/research/partial-credit";
import { z } from "zod";

const citationSchema = z.object({ passage: z.string(), sourceId: z.string() });

const EXAM_FORMAT_KINDS = [
  "multipleChoice",
  "trueFalse",
  "essay",
  "shortAnswer",
  "numeric",
  "oral",
  "practical",
  "other",
] as const;

const EXAM_SCORING_METHODS = [
  "raw",
  "wrongCancelsRight",
  "itemResponseTheory",
  "scaled",
  "other",
] as const;

const EXAM_DATE_KINDS = [
  "registrationStart",
  "registrationEnd",
  "exam",
  "results",
  "other",
] as const;

export const TOPIC_FREQUENCY_LEVELS = ["high", "medium", "low"] as const;

const blueprintSubjectSchema = z.object({
  choiceGroup: z.string().nullable().optional(),
  citation: citationSchema,
  group: z.string().nullable().optional(),
  matrix: z.array(z.string()).optional(),
  name: z.string(),
  partOf: z.string().nullable().optional(),
  questions: z.number().int().nullable(),
  shortName: z.string().nullable().optional(),
  topicGroups: z.array(z.object({ name: z.string(), topics: z.array(z.string()) })).optional(),
  topics: z.array(z.string()),
  weight: z.number().nullable(),
});

const blueprintFormatSchema = z.object({
  citation: citationSchema,
  description: z.string(),
  entry: numericEntrySchema.nullable().optional(),
  kind: z.enum(EXAM_FORMAT_KINDS),
  options: z.number().int().nullable(),
  partialCredit: partialCreditSchema.optional(),
  select: optionSelectSchema.nullable().optional(),
  share: z.number().min(0).max(1).nullable().optional(),
});

const RULE_KINDS = ["passMark", "other"] as const;

const blueprintRuleSchema = z.object({
  citation: citationSchema,
  kind: z.enum(RULE_KINDS).optional(),
  text: z.string(),
  translations: z.record(z.string(), z.string()).optional(),
});

export const sectionNavigationSchema = z.object({
  answerChanges: z.number().int().min(0).nullable(),
  forwardOnly: z.boolean(),
  itemSeconds: z.number().int().min(1).nullable(),
  mustAnswer: z.boolean(),
});

export type SectionNavigation = z.infer<typeof sectionNavigationSchema>;

const mockSectionSchema = z.object({
  breakAfterMinutes: z.number().int().min(1).nullable().optional(),
  day: z.number().int().nullable(),
  kind: z.enum(["objective", "written", "listening", "speaking", "practical"]),
  minutes: z.number().int().nullable(),
  name: z.string(),
  navigation: sectionNavigationSchema.nullable().optional(),
  questions: z.number().int().nullable(),
  tasks: z
    .array(
      z.object({
        count: z.number().int().min(1),
        description: z.string(),
        plays: z.number().int().min(1).max(2).nullable().optional(),
      }),
    )
    .optional(),
  tools: z.string().nullable().optional(),
});

const mockConditionsSchema = z.object({
  adaptive: z.boolean(),
  citations: z.array(citationSchema),
  order: z.string().nullable(),
  scoring: z.object({
    description: z.string(),
    method: z.enum(EXAM_SCORING_METHODS),
    relative: z.boolean().optional(),
    scale: z
      .object({
        fromPercent: z.object({ base: z.number(), perPercent: z.number() }).nullable(),
        max: z.number(),
        min: z.number(),
        name: z.string().nullable(),
        passScore: z.number().nullable(),
        step: z.number().positive().nullable(),
      })
      .nullable()
      .optional(),
    wrongPenalty: z.number().min(0).max(1).nullable().optional(),
  }),
  sections: z.array(mockSectionSchema),
  timeLimitMinutes: z.number().int().nullable(),
  totalQuestions: z.number().int().nullable(),
});

const pastQuestionsSchema = z.object({
  checkedAt: z.iso.datetime(),
  edition: z.string().nullable(),
  source: z.object({ title: z.string().nullable(), url: z.string() }).nullable(),
  subjects: z.array(z.object({ name: z.string(), questions: z.number().int().min(0) })),
});

const pastOptionsSchema = z.object({
  checkedAt: z.iso.datetime(),
  edition: z.string().nullable(),
  options: z.number().int().min(2).nullable(),
  source: z.object({ title: z.string().nullable(), url: z.string() }).nullable(),
});

const pastTopicSchema = z.object({
  appearances: z.number().int().min(0).nullable(),
  level: z.enum(TOPIC_FREQUENCY_LEVELS),
  topic: z.string(),
});

const pastTopicFrequencySchema = z.object({
  checkedAt: z.iso.datetime().nullable(),
  subjects: z.array(
    z.object({
      basis: z.string(),
      name: z.string(),
      source: z.object({ title: z.string().nullable(), url: z.string() }),
      topics: z.array(pastTopicSchema),
    }),
  ),
});

export type PastTopicFrequency = z.infer<typeof pastTopicFrequencySchema>;

export const examStructureSchema = z.object({
  formats: z.array(blueprintFormatSchema),
  mock: mockConditionsSchema.nullable(),
  pastOptions: pastOptionsSchema.nullable().optional(),
  pastQuestions: pastQuestionsSchema.nullable().optional(),
  pastTopicFrequency: pastTopicFrequencySchema.nullable().optional(),
  rules: z.array(blueprintRuleSchema),
  subjects: z.array(blueprintSubjectSchema),
  testedLanguage: z
    .object({ citation: citationSchema, language: z.string() })
    .nullable()
    .optional(),
});

const clockTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u);

const examDateSchema = z.object({
  citation: citationSchema,
  date: z.iso.date(),
  kind: z.enum(EXAM_DATE_KINDS),
  label: z.string(),
  startTime: clockTimeSchema.nullable(),
});

const readingProblemSchema = z.discriminatedUnion("kind", [
  z.object({ citation: citationSchema, kind: z.literal("missingSubject"), name: z.string() }),
  z.object({
    citation: citationSchema,
    kind: z.literal("missingCount"),
    questions: z.number().int(),
    subject: z.string(),
  }),
  z.object({ kind: z.literal("countsOffTotal"), sum: z.number().int(), total: z.number().int() }),
  z.object({
    kind: z.literal("unconfirmed"),
    part: z.enum(["examDate", "scale", "topics"]),
    subject: z.string().nullable(),
  }),
]);

const readingCheckSchema = z.object({
  checkedAt: z.iso.datetime(),
  problems: z.array(readingProblemSchema),
});

export type ReadingProblem = z.infer<typeof readingProblemSchema>;
export type ReadingCheck = z.infer<typeof readingCheckSchema>;

export const examEditionSchema = z.object({
  check: readingCheckSchema.nullable(),
  citations: z.array(citationSchema),
  dates: z.array(examDateSchema),
  noticeUrl: z.string().nullable(),
  questionCount: z.number().int().nullable(),
  sourceHash: z.string().nullable(),
  timeZone: z.string().nullable(),
  year: z.number().int().nullable(),
});

export const topicFrequencySchema = z.array(
  z.object({
    appearances: z.number().int().min(0).nullable(),
    basis: z.string(),
    citation: citationSchema,
    level: z.enum(TOPIC_FREQUENCY_LEVELS),
    subject: z.string(),
    topic: z.string(),
  }),
);

export type Citation = z.infer<typeof citationSchema>;
export type ExamStructure = z.infer<typeof examStructureSchema>;
export type ExamEdition = z.infer<typeof examEditionSchema>;
export type TopicFrequency = z.infer<typeof topicFrequencySchema>;
export type TopicFrequencyLevel = (typeof TOPIC_FREQUENCY_LEVELS)[number];
export type ExamDate = z.infer<typeof examDateSchema>;

export type BlueprintContent = {
  edition: ExamEdition;
  structure: ExamStructure;
  topicFrequency: TopicFrequency;
};

export function isFormatShare(share: number | null | undefined): share is number {
  return typeof share === "number" && share > 0 && share <= 1;
}

export function toAnswerFormat(format: {
  entry: ExamStructure["formats"][number]["entry"];
  select: ExamStructure["formats"][number]["select"];
}) {
  return {
    ...(format.entry ? { entry: format.entry } : {}),
    ...(format.select && format.select !== 1 ? { select: format.select } : {}),
  };
}
