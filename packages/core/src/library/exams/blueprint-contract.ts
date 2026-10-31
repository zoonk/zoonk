import { numericEntrySchema, optionSelectSchema } from "@zoonk/ai/tasks/items/schemas";
import { partialCreditSchema } from "@zoonk/ai/tasks/research/partial-credit";
import { z } from "zod";
import {
  TOPIC_FREQUENCY_LEVELS,
  pastOptionsSchema,
  pastQuestionsSchema,
  pastTopicFrequencySchema,
} from "./blueprint-past-contract";

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

const EXAM_DATE_KINDS = [
  "registrationStart",
  "registrationEnd",
  "exam",
  "results",
  "other",
] as const;

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
  /** The parts named by the documents; absent when the documents leave scope unknown. */
  sections: z.array(z.string()).optional(),
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

const POINTS_MINIMUM_UNITS = ["points", "percent"] as const;

export const pointsMinimumSchema = z.object({
  unit: z.enum(POINTS_MINIMUM_UNITS),
  value: z.number().positive(),
});

export type PointsMinimum = z.infer<typeof pointsMinimumSchema>;

const markingRowSchema = z.object({
  citation: citationSchema,
  format: z
    .enum(EXAM_FORMAT_KINDS)
    .nullable()
    .meta({ description: "The question format it scores; null for every format" }),
  part: z
    .string()
    .nullable()
    .meta({
      description:
        "The test or block it scores, as a subject's `group` or `name` writes it; null for the whole exam",
    }),
  points: z.number().positive().meta({ description: "What a right answer earns" }),
  questions: z
    .number()
    .int()
    .min(1)
    .nullable()
    .meta({ description: "How many questions it covers; null when the notice doesn't say" }),
  select: blueprintFormatSchema.shape.select.meta({
    description:
      "The number of options to select, or all for multiple selection; null when unstated",
  }),
  wrongPoints: z
    .number()
    .min(0)
    .nullable()
    .meta({
      description:
        "Points lost per wrong answer; null when unstated, so the exam-wide penalty share applies",
    }),
});

const scoredPartSchema = z.object({
  citation: citationSchema,
  maxPoints: z
    .number()
    .positive()
    .nullable()
    .meta({ description: "The most points it gives; null when the notice doesn't say" }),
  minimum: pointsMinimumSchema
    .nullable()
    .meta({
      description: "The least every candidate must reach in it; null when none applies to all",
    }),
  name: z
    .string()
    .meta({ description: "The test or block, as a subject's `group` or `name` writes it" }),
  qualifying: z
    .boolean()
    .meta({ description: "It only has to reach its minimum and doesn't count toward the result" }),
  questions: z
    .number()
    .int()
    .min(1)
    .nullable()
    .meta({ description: "How many questions it has; null when the notice doesn't say" }),
});

export type MarkingRow = z.infer<typeof markingRowSchema>;
export type ScoredPart = z.infer<typeof scoredPartSchema>;

const mockConditionsSchema = z.object({
  adaptive: z.boolean(),
  citations: z.array(citationSchema),
  order: z.string().nullable(),
  scoring: z.object({
    description: z.string(),
    marking: z
      .array(markingRowSchema)
      .optional()
      .meta({
        description:
          "How a right and a wrong answer score where it differs by test or format, in the notice's order; a question no row covers earns 1 point",
      }),
    method: z.enum(["raw", "wrongCancelsRight", "itemResponseTheory", "scaled", "other"]),
    parts: z
      .array(scoredPartSchema)
      .optional()
      .meta({
        description: "Each test or block the notice gives questions, points or a minimum for",
      }),
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
    totalMinimum: pointsMinimumSchema
      .extend({ citation: citationSchema })
      .nullable()
      .optional()
      .meta({
        description:
          "The least every candidate must reach in the objective tests that count, added together; null when none",
      }),
    wrongPenalty: z.number().min(0).max(1).nullable().optional(),
  }),
  sections: z.array(mockSectionSchema),
  timeLimitMinutes: z.number().int().nullable(),
  totalQuestions: z.number().int().nullable(),
});

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
  /** Every document the reading read, the notice first, so a new reading reads them all again. */
  sourceIds: z.array(z.string()).optional(),
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
export type ExamDate = z.infer<typeof examDateSchema>;

export type BlueprintContent = {
  edition: ExamEdition;
  structure: ExamStructure;
  topicFrequency: TopicFrequency;
};
