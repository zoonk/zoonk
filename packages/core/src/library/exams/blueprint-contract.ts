import { z } from "zod";

/**
 * Where a blueprint fact came from: the passage of a stored source it was read
 * from, quoted as written. Facts without a passage that matches are never
 * stored, so every field of a blueprint can be traced to its source.
 */
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
  citation: citationSchema,
  name: z.string(),
  questions: z.number().int().nullable(),
  topics: z.array(z.string()),
  /** The subject's share of the final score, from 0 to 1, when the notice gives one. */
  weight: z.number().nullable(),
});

const blueprintFormatSchema = z.object({
  citation: citationSchema,
  description: z.string(),
  kind: z.enum(EXAM_FORMAT_KINDS),
  /** Options per question for choice formats, such as 5 for ENEM. */
  options: z.number().int().nullable(),
});

const blueprintRuleSchema = z.object({ citation: citationSchema, text: z.string() });

const mockSectionSchema = z.object({
  day: z.number().int().nullable(),
  minutes: z.number().int().nullable(),
  name: z.string(),
  questions: z.number().int().nullable(),
});

/**
 * The conditions a mock exam copies: questions, sections and their order, time
 * and scoring. A notice states them in several places, so they cite every
 * passage they came from.
 */
const mockConditionsSchema = z.object({
  /**
   * A later section's questions depend on how the one before it went, like the digital SAT's
   * modules. Older rows didn't store it, so it reads as false.
   */
  adaptive: z.boolean().default(false),
  citations: z.array(citationSchema),
  order: z.string().nullable(),
  scoring: z.object({ description: z.string(), method: z.enum(EXAM_SCORING_METHODS) }),
  sections: z.array(mockSectionSchema),
  timeLimitMinutes: z.number().int().nullable(),
  totalQuestions: z.number().int().nullable(),
});

/** The part of an exam that rarely changes between editions. */
export const examStructureSchema = z.object({
  formats: z.array(blueprintFormatSchema),
  mock: mockConditionsSchema.nullable(),
  rules: z.array(blueprintRuleSchema),
  subjects: z.array(blueprintSubjectSchema),
});

/** Local clock time as the notice states it, 24-hour "HH:MM". */
const clockTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u);

const examDateSchema = z.object({
  citation: citationSchema,
  date: z.iso.date(),
  kind: z.enum(EXAM_DATE_KINDS),
  label: z.string(),
  /**
   * When the exam starts that day, in the edition's time zone, so mocks can run at the real
   * exam's time of day. Older rows didn't store it, so it reads as unknown.
   */
  startTime: clockTimeSchema.nullable().default(null),
});

/** The current edition: what a new notice changes every year. */
export const examEditionSchema = z.object({
  /** Where the year and the question count were read. */
  citations: z.array(citationSchema),
  dates: z.array(examDateSchema),
  noticeUrl: z.string().nullable(),
  questionCount: z.number().int().nullable(),
  /** The hash of the source this edition was read from, so a check knows it's behind. */
  sourceHash: z.string().nullable(),
  /** The IANA time zone the notice's times are in ("horário de Brasília" is America/Sao_Paulo). */
  timeZone: z.string().nullable().default(null),
  year: z.number().int().nullable(),
});

/** How often the board asks each topic, from its past papers. */
export const topicFrequencySchema = z.array(
  z.object({
    /**
     * How many questions asked the topic in the past papers read, such as "4 times" on last
     * year's class exam; null when the basis doesn't give a count.
     */
    appearances: z.number().int().min(0).nullable().default(null),
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

/** Everything read from an exam's documents, before it's stored as a blueprint. */
export type BlueprintContent = {
  edition: ExamEdition;
  structure: ExamStructure;
  topicFrequency: TopicFrequency;
};
