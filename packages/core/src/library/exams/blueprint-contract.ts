import { numericEntrySchema, optionSelectSchema } from "@zoonk/ai/tasks/v2/items/schemas";
import { partialCreditSchema } from "@zoonk/ai/tasks/v2/research/partial-credit";
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
  /**
   * The choice this subject is an option of, when candidates take only one of several subjects
   * (ENEM's foreign language: English or Spanish, picked at registration). Every option of a
   * choice has the same text, and a learner studies only the one they picked (see
   * `toChosenStructure`). Null or absent otherwise (and on blueprints read before choices were).
   */
  choiceGroup: z.string().nullable().optional(),
  citation: citationSchema,
  /**
   * How the notice groups its subjects, such as its basic knowledge part (P1); null or absent when
   * it doesn't (and on blueprints read before groups were).
   */
  group: z.string().nullable().optional(),
  /**
   * The competency and ability statements of a syllabus written as a skills matrix (ENEM's),
   * when its `topics` are the contents the matrix is paired with ("objects of knowledge"):
   * detail under them. Absent for every other syllabus (and on blueprints read before).
   */
  matrix: z.array(z.string()).optional(),
  name: z.string(),
  /**
   * The subject whose questions include this one's, when the notice counts it inside another (an
   * option of ENEM's foreign language is part of its languages area's 45 questions), so its
   * questions are counted once. Null or absent otherwise.
   */
  partOf: z.string().nullable().optional(),
  questions: z.number().int().nullable(),
  /**
   * What learners call the subject when the notice's name is long ("Constitutional Law" for
   * "Basics of Constitutional Law and of the Internal Rules of the Câmara dos Deputados"), for
   * labels with little room; null or absent when the name is short already (and on blueprints
   * read before short names were).
   */
  shortName: z.string().nullable().optional(),
  /**
   * The headings the syllabus puts the subject's topics under (ENEM's physics, chemistry and
   * biology in natural sciences), in order, each with its topics as `topics` writes them. Absent
   * when it has none (and on blueprints read before headings were).
   */
  topicGroups: z.array(z.object({ name: z.string(), topics: z.array(z.string()) })).optional(),
  topics: z.array(z.string()),
  /** The subject's share of the final score, from 0 to 1, when the notice gives one. */
  weight: z.number().nullable(),
});

const blueprintFormatSchema = z.object({
  citation: citationSchema,
  description: z.string(),
  /**
   * How a numeric answer is entered, when the notice says: a whole number (JEE Main), to n
   * decimal places (JEE Advanced) or a fraction or decimal (the SAT's grid-ins). Null or absent
   * for other kinds and on blueprints read before.
   */
  entry: numericEntrySchema.nullable().optional(),
  kind: z.enum(EXAM_FORMAT_KINDS),
  /** Options per question for choice formats, such as 5 for ENEM. */
  options: z.number().int().nullable(),
  /**
   * How a question with several picks scores when answered partly right, as the notice says
   * (`getPickCredit`): JEE Advanced's +1 per right option. Absent when it doesn't say (only all
   * the right options earn the question), for other kinds and on blueprints read before.
   */
  partialCredit: partialCreditSchema.optional(),
  /**
   * How many options a multiple-choice question asks to pick when it's several: a fixed number
   * ("choose two") or "all" (JEE Advanced's "one or more"). Null or absent for one, for other
   * kinds and on blueprints read before.
   */
  select: optionSelectSchema.nullable().optional(),
  /**
   * The share of the exam's objective questions asked in this format, from 0 to 1, when the notice
   * states it as counts or a percent (JEE Main's 20 multiple-choice and 5 numeric questions per
   * subject: 0.8 and 0.2), which mocks ask in that mix (`getMockFormatMix`). Null or absent when
   * it doesn't say, for written, oral and practical formats and on blueprints read before.
   */
  share: z.number().min(0).max(1).nullable().optional(),
});

const RULE_KINDS = ["passMark", "other"] as const;

const blueprintRuleSchema = z.object({
  citation: citationSchema,
  /**
   * `passMark`: what it takes to pass the exam or one of its tests ("Passed with at least 40 of the
   * 80 points (50%)."); absent on rows read before kinds were.
   */
  kind: z.enum(RULE_KINDS).optional(),
  text: z.string(),
  /**
   * A pass mark in each of the app's languages but the notice's, by language code, translated when
   * the notice was read (`withPassMarkTranslations`), so a learner reads it in theirs. Absent on
   * other rules and on blueprints read before.
   */
  translations: z.record(z.string(), z.string()).optional(),
});

/**
 * How candidates move through a section, as the notice says: `forwardOnly` when a question can't be
 * gone back to once left (computer-adaptive sections, listening parts), `itemSeconds` when each
 * question has its own clock, `mustAnswer` when a question must be answered before the next one
 * shows, and `answerChanges` how many answers a forward-only section's review at its end may
 * change (the GMAT's 3), null for no review.
 */
export const sectionNavigationSchema = z.object({
  answerChanges: z.number().int().min(0).nullable(),
  forwardOnly: z.boolean(),
  itemSeconds: z.number().int().min(1).nullable(),
  mustAnswer: z.boolean(),
});

export type SectionNavigation = z.infer<typeof sectionNavigationSchema>;

const mockSectionSchema = z.object({
  /**
   * The break the notice gives after this section, before the next one starts, in minutes; null
   * or absent when it gives none (and on blueprints read before).
   */
  breakAfterMinutes: z.number().int().min(1).nullable().optional(),
  day: z.number().int().nullable(),
  /**
   * `written`: answered in writing (a discursive test, an essay, a legal brief), so a mock never
   * fills it with objective questions; `listening` (answered after hearing recordings), `speaking`
   * (an oral test) and `practical` (stations, a lab, a physical test), which mocks say they leave
   * out until they can run them; absent on rows read before kinds were (see `isWrittenSection`).
   */
  kind: z.enum(["objective", "written", "listening", "speaking", "practical"]).optional(),
  minutes: z.number().int().nullable(),
  name: z.string(),
  /**
   * How candidates move through it (see `sectionNavigationSchema`). Null or absent when the notice
   * doesn't say: candidates move freely, as on paper.
   */
  navigation: sectionNavigationSchema.nullable().optional(),
  questions: z.number().int().nullable(),
  /**
   * What a written section asks, as the notice says it (two discursive answers of up to 20 lines),
   * or a listening section's recording parts, each with how many times it's played (`plays`: 1 or
   * 2, null when the notice doesn't say; absent on written tasks and rows read before plays were).
   * A part's description is empty when the check didn't keep it: its questions and plays stand.
   */
  tasks: z
    .array(
      z.object({
        count: z.number().int().min(1),
        description: z.string(),
        plays: z.number().int().min(1).max(2).nullable().optional(),
      }),
    )
    .optional(),
  /**
   * What may be used or is given in it, in one sentence of the notice's (no calculator, a
   * periodic table provided); null or absent when the notice doesn't say.
   */
  tools: z.string().nullable().optional(),
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
  scoring: z.object({
    description: z.string(),
    method: z.enum(EXAM_SCORING_METHODS),
    /**
     * The result depends on the other candidates: a percentile, a standardized score (Unicamp's
     * 500 + 100z), a curve or cut-offs set after marking. Absent on blueprints read before.
     */
    relative: z.boolean().optional(),
    /**
     * The scale the exam reports its result on, as the notice states it (EXANI-II's Ceneval index
     * from 700 to 1300), shown beside a mock's share of right answers, with the score that passes
     * on it (`passScore`). `fromPercent` only where the notice publishes a linear conversion from
     * the share of right answers (700 plus 6 per percent), which mocks then use. Null or absent when
     * the notice states none (and on blueprints read before).
     */
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
    /**
     * For `wrongCancelsRight`, the share of a right answer each wrong one takes away: 1 when a wrong
     * answer cancels a right one (Cebraspe), 0.25 for JEE's -1 against +4, 1/3 for UPSC's. Null or
     * absent when the notice gives no ratio (and on blueprints read before), which reads as 1.
     */
    wrongPenalty: z.number().min(0).max(1).nullable().optional(),
  }),
  sections: z.array(mockSectionSchema),
  timeLimitMinutes: z.number().int().nullable(),
  totalQuestions: z.number().int().nullable(),
});

/**
 * How many questions each subject got in the exam's latest edition, for a notice that names its
 * subjects without their counts (the OAB's first phase): looked up once from one source that gives
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
 * objective questions"): looked up once from one source (`checkedAt`), and null `options` when none
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
  /** Null while subjects a lookup couldn't reach (its call failed) wait for the next lookup. */
  checkedAt: z.iso.datetime().nullable(),
  subjects: z.array(
    z.object({
      /** What the source counted or ranked, in its words ("questions from 2009 to 2024"). */
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
  /**
   * The language the exam certifies or measures (IELTS: English), as an ISO 639-1 code, so a goal
   * preparing for it learns that language whatever the exam's name. Null when the notice tests
   * subjects, a language among them included; absent on blueprints read before.
   */
  testedLanguage: z
    .object({ citation: citationSchema, language: z.string() })
    .nullable()
    .optional(),
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

/**
 * What the check of a reading found it left out of the documents: a subject they say the exam
 * covers (the OAB's ethics, which a reading of the 48th exam's notice dropped), a subject's
 * question count they state, subjects' counts that don't add up to the exam's questions, or what
 * the reading stated that no check could confirm from what it quoted (`unconfirmed`): the result's
 * scale, the exam's day or a subject's topics (`subject`).
 */
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

/**
 * The check of the stored reading (`findReadingProblems`): valid when it found no problem. The
 * notice is read once and shared, so a reading with problems is read again by the next research
 * that needs it, a few times at most (`readings`) until the notice changes.
 */
const readingCheckSchema = z.object({
  checkedAt: z.iso.datetime(),
  problems: z.array(readingProblemSchema),
  /** How many times this very document was read, the first reading included. */
  readings: z.number().int().min(0),
});

export type ReadingProblem = z.infer<typeof readingProblemSchema>;
export type ReadingCheck = z.infer<typeof readingCheckSchema>;

/** The current edition: what a new notice changes every year. */
export const examEditionSchema = z.object({
  /**
   * The check of the reading this edition was stored from; absent on readings stored before
   * readings were checked, and on a learner's own material, which isn't.
   */
  check: readingCheckSchema.optional(),
  /** Where the year and the question count were read. */
  citations: z.array(citationSchema),
  dates: z.array(examDateSchema),
  noticeUrl: z.string().nullable(),
  questionCount: z.number().int().nullable(),
  /** The hash of the source this edition was read from, so a check knows it's behind. */
  sourceHash: z.string().nullable(),
  /** The IANA time zone the notice's times are in ("Brasília time" is America/Sao_Paulo). */
  timeZone: z.string().nullable().default(null),
  year: z.number().int().nullable(),
});

const storedSourceHashSchema = z.object({ sourceHash: z.string() });

/**
 * The hash of the source a stored edition was read from, read on its own: an edition stored in an
 * older shape still says which document it was read from, so a change to the shape never makes a
 * notice look unread (and read again, with learners told it changed). Null when it names none.
 */
export function readStoredSourceHash(edition: unknown): string | null {
  return storedSourceHashSchema.safeParse(edition).data?.sourceHash ?? null;
}

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

/** Whether a read share of the exam's objective questions is one a mock can ask in (0 to 1). */
export function isFormatShare(share: number | null | undefined): share is number {
  return typeof share === "number" && share > 0 && share <= 1;
}

/**
 * How a read format's questions are answered, when the notice says: several picks for multiple
 * choice (`select`), an answer box for numeric questions (`entry`). Only stated ones are stored.
 */
export function toAnswerFormat(format: {
  entry: ExamStructure["formats"][number]["entry"];
  select: ExamStructure["formats"][number]["select"];
}) {
  return {
    ...(format.entry ? { entry: format.entry } : {}),
    ...(format.select && format.select !== 1 ? { select: format.select } : {}),
  };
}
