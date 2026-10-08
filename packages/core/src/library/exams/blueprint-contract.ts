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
  /**
   * How the notice groups its subjects, such as "Conhecimentos básicos (P1)"; null or absent when
   * it doesn't (and on blueprints read before groups were).
   */
  group: z.string().nullable().optional(),
  /**
   * The competência and habilidade statements of a syllabus written as a skills matrix (ENEM's),
   * when its `topics` are the contents the matrix is paired with ("objetos de conhecimento"):
   * detail under them. Absent for every other syllabus (and on blueprints read before).
   */
  matrix: z.array(z.string()).optional(),
  name: z.string(),
  questions: z.number().int().nullable(),
  /**
   * What learners call the subject when the notice's name is long ("Direito Constitucional" for
   * "Noções de Direito Constitucional e de Regimento Interno da Câmara dos Deputados"), for
   * labels with little room; null or absent when the name is short already (and on blueprints
   * read before short names were).
   */
  shortName: z.string().nullable().optional(),
  /**
   * The headings the syllabus puts the subject's topics under (ENEM's Física, Química and Biologia
   * in Ciências da Natureza), in order, each with its topics as `topics` writes them. Absent when
   * it has none (and on blueprints read before headings were).
   */
  topicGroups: z.array(z.object({ name: z.string(), topics: z.array(z.string()) })).optional(),
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

const RULE_KINDS = ["passMark", "other"] as const;

const blueprintRuleSchema = z.object({
  citation: citationSchema,
  /**
   * `passMark`: what it takes to pass the exam or one of its tests ("Aprovado com no mínimo 40
   * dos 80 pontos (50%)."); absent on rows read before kinds were.
   */
  kind: z.enum(RULE_KINDS).optional(),
  text: z.string(),
});

const mockSectionSchema = z.object({
  day: z.number().int().nullable(),
  /**
   * `written`: answered in writing (a discursive test, a redação, a peça técnica), so a mock never
   * fills it with objective questions; absent on rows read before kinds were (see
   * `isWrittenSection`).
   */
  kind: z.enum(["objective", "written"]).optional(),
  minutes: z.number().int().nullable(),
  name: z.string(),
  questions: z.number().int().nullable(),
  /** What a written section asks, as the notice says it ("2 questões discursivas de até 20 linhas"). */
  tasks: z.array(z.object({ count: z.number().int().min(1), description: z.string() })).optional(),
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

/**
 * How many questions each subject got in the exam's latest edition, for a notice that names its
 * subjects without their counts (the OAB's 1ª fase): looked up once from one source that gives
 * every subject's count for one edition (`checkedAt`), and empty when none was found. Candidates
 * plan by these counts, so the plan weighs subjects by them and screens show them with the source.
 */
const pastQuestionsSchema = z.object({
  checkedAt: z.iso.datetime(),
  edition: z.string().nullable(),
  source: z.object({ title: z.string().nullable(), url: z.string() }).nullable(),
  subjects: z.array(z.object({ name: z.string(), questions: z.number().int().min(0) })),
});

/**
 * How many options each multiple-choice question had in the exam's latest edition, for a notice
 * that says its questions are multiple choice without the number (the Enem's page says "180
 * questões objetivas"): looked up once from one source (`checkedAt`), and null `options` when none
 * was found. Questions for the exam are written and picked with that many options.
 */
const pastOptionsSchema = z.object({
  checkedAt: z.iso.datetime(),
  edition: z.string().nullable(),
  options: z.number().int().min(2).nullable(),
  source: z.object({ title: z.string().nullable(), url: z.string() }).nullable(),
});

/**
 * How often the exam asked the topics of some of its subjects in past editions, for a notice whose
 * documents don't say (a reading of past papers fills `topicFrequency` instead): looked up once
 * (`checkedAt`), one source per subject that counted or ranked its topics, each topic in the
 * notice's own words. Empty when no source was found. A plan short on time leaves out the topics
 * asked least first, and screens say where that came from.
 */
const pastTopicSchema = z.object({
  appearances: z.number().int().min(0).nullable(),
  level: z.enum(TOPIC_FREQUENCY_LEVELS),
  topic: z.string(),
});

const pastTopicFrequencySchema = z.object({
  checkedAt: z.iso.datetime(),
  subjects: z.array(
    z.object({
      /** What the source counted or ranked, in its words ("questões de 2009 a 2024"). */
      basis: z.string(),
      name: z.string(),
      source: z.object({ title: z.string().nullable(), url: z.string() }),
      topics: z.array(pastTopicSchema),
    }),
  ),
});

export type PastTopicFrequency = z.infer<typeof pastTopicFrequencySchema>;

/** The part of an exam that rarely changes between editions. */
export const examStructureSchema = z.object({
  formats: z.array(blueprintFormatSchema),
  mock: mockConditionsSchema.nullable(),
  /** Absent until a lookup ran (see `pastOptionsSchema`); readings of the notice never set it. */
  pastOptions: pastOptionsSchema.nullable().optional(),
  /** Absent until a lookup ran (see `pastQuestionsSchema`); readings of the notice never set it. */
  pastQuestions: pastQuestionsSchema.nullable().optional(),
  /** Absent until a lookup ran (see `pastTopicFrequencySchema`); readings never set it. */
  pastTopicFrequency: pastTopicFrequencySchema.nullable().optional(),
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
export type TopicFrequencyLevel = (typeof TOPIC_FREQUENCY_LEVELS)[number];
export type ExamDate = z.infer<typeof examDateSchema>;

/** Everything read from an exam's documents, before it's stored as a blueprint. */
export type BlueprintContent = {
  edition: ExamEdition;
  structure: ExamStructure;
  topicFrequency: TopicFrequency;
};
