import { GoalKind } from "@zoonk/db";
import { z } from "zod";
import { TOPIC_FREQUENCY_LEVELS } from "../../library/exams/blueprint-contract";
import { writtenPracticeSchema } from "../../plans/written-practice-contract";

const countSchema = z.int().min(0);
const isoDateSchema = z.iso.date();

/**
 * Why a topic or a subject isn't in the plan: the learner took it out, they start past it, time,
 * or nothing teaches it yet.
 */
const notPlannedReasonSchema = z
  .enum(["skipped", "pastBasics", "time", "missing"])
  .nullable()
  .meta({
    description:
      "Why it isn't in the plan: `skipped` (the learner took the subject out; `restoreAreas` with its `areas` brings it back), `pastBasics` (a subject's basics the plan starts past: the learner said they know them, or does well in the subject with harder lessons), `time` (it doesn't fit before the deadline at the current pace), `missing` (no skill of the plan teaches it yet). Null when it's in the plan",
  });

const syllabusChapterSchema = z
  .object({
    chapterId: z
      .uuid()
      .nullable()
      .meta({
        description:
          "Its page is `GET /v1/goals/{goalId}/chapters/{chapterId}`; null while its lessons are still being written",
      }),
    lessonsDone: countSchema,
    lessonsTotal: countSchema,
    nextDate: isoDateSchema
      .nullable()
      .meta({ description: "The next day the plan studies it; null once it's done" }),
    position: z
      .int()
      .min(1)
      .meta({
        description:
          "Its number in the subject, in the subject's order (the ones done first): every screen calls it Chapter 4",
      }),
    state: z
      .enum(["done", "current", "upcoming"])
      .meta({ description: "`current` holds the plan's next lesson; at most one chapter has it" }),
    title: z.string(),
    writing: z
      .boolean()
      .meta({ description: "Lessons still being written: its counts are stand-ins" }),
  })
  .meta({ id: "SyllabusChapter" });

const syllabusTopicSchema = z
  .object({
    chapters: z
      .array(syllabusChapterSchema)
      .meta({
        description:
          "The chapters that teach it, in the subject's order; empty when `status` is null",
      }),
    frequency: z
      .enum(TOPIC_FREQUENCY_LEVELS)
      .nullable()
      .meta({
        description:
          'How often past exams asked it, from a reading of past papers or a source that counted them (the subject\'s `topicFrequencySource` cites the latter): `high` is shown as "Appears a lot". Null when nothing says',
      }),
    heading: z
      .string()
      .nullable()
      .meta({
        description:
          'The heading the notice lists it under inside its subject, such as "Física" in ENEM\'s Ciências da Natureza: topics with the same heading come together, in order. Null when the subject has no headings',
      }),
    name: z.string().meta({ description: "In the source's own words, as the notice lists it" }),
    nextDate: isoDateSchema
      .nullable()
      .meta({ description: "When the plan studies it next; null once studied or when unknown" }),
    notPlannedReason: notPlannedReasonSchema,
    status: z
      .enum(["studied", "inProgress", "toStudy", "notPlanned"])
      .nullable()
      .meta({
        description:
          "From the plan's lessons on it. Null when the plan doesn't say which skills teach which topic (plans made before topics were mapped): show the topic without a status",
      }),
  })
  .meta({ id: "SyllabusTopic" });

const syllabusSubjectSchema = z
  .object({
    areas: z
      .array(z.string())
      .meta({
        description:
          "The plan's areas it gathers, as plan changes (`focusAreas`, `skipAreas`, `restoreAreas`) name them",
      }),
    chapters: z
      .array(syllabusChapterSchema)
      .meta({
        description:
          "Every chapter of the plan in this subject: the ones done, then in the order the plan studies them next",
      }),
    group: z
      .string()
      .nullable()
      .meta({ description: 'The notice\'s grouping, such as "Conhecimentos básicos (P1)"' }),
    imageUrl: z
      .string()
      .nullable()
      .meta({ description: "The icon of the Library course the plan teaches it with" }),
    key: z
      .string()
      .meta({ description: "Stable within the goal's syllabus, URL-safe: the subject's page" }),
    lessonsDone: countSchema,
    lessonsTotal: countSchema,
    matrix: z
      .array(z.string())
      .meta({
        description:
          "When the notice's syllabus for it is a skills matrix (ENEM's competências and habilidades) and its `topics` are the contents the matrix is paired with: the matrix's statements, word for word, as detail. Empty otherwise",
      }),
    name: z.string().meta({ description: "The notice's own name for it, or the module's" }),
    nextDate: isoDateSchema
      .nullable()
      .meta({ description: "The next day the plan studies it; null once done or out of the plan" }),
    notPlannedReason: notPlannedReasonSchema,
    questions: countSchema
      .nullable()
      .meta({ description: "Questions on it in the exam, when the notice says" }),
    share: z
      .number()
      .min(0)
      .max(1)
      .nullable()
      .meta({
        description: "Its share of the exam: the notice's weight, or its share of the questions",
      }),
    shortName: z
      .string()
      .meta({
        description: "A short label for it, for places with little room such as a lesson's subject",
      }),
    source: z
      .enum(["notice", "plan"])
      .meta({
        description:
          "`notice`: a subject of the exam's notice. `plan`: a module of the plan, or an area the plan adds outside the notice",
      }),
    topicFrequencySource: z
      .object({ basis: z.string(), title: z.string().nullable(), url: z.string() })
      .nullable()
      .meta({
        description:
          "Where how often the exam asks this subject's topics comes from, when the notice doesn't say and a source of its past papers does: the plan leaves out the topics asked least first. `basis` says what the source counted. Null otherwise",
      }),
    topics: z
      .array(syllabusTopicSchema)
      .meta({ description: "The notice's topics in its own order; empty for modules" }),
    topicsStudied: countSchema
      .nullable()
      .meta({ description: "Topics studied; null when the plan doesn't map topics" }),
  })
  .meta({ id: "SyllabusSubject" });

/**
 * The structure of a goal, in the learner's terms: for an exam with a notice, its subjects and
 * topics in the notice's own words and order, each with progress and when the plan reaches it;
 * for other goals, the plan's modules with their chapters.
 */
export const syllabusViewSchema = z
  .object({
    courseWeights: z
      .object({
        course: z.string(),
        edition: z.string().nullable(),
        institution: z.string(),
        source: z.object({ title: z.string().nullable(), url: z.string() }).nullable(),
        subjects: z.array(z.object({ name: z.string(), weight: z.number() })),
      })
      .nullable()
      .meta({
        description:
          "How the learner's course weighs each of the exam's parts at their institution (an entrance exam's selection weights), as one source gives them; the plan gives the parts weighed more a bigger share of the time. Null when the goal names no course and institution or the weights weren't found",
      }),
    fromMaterial: z
      .boolean()
      .meta({
        description:
          "The subjects and topics come from the learner's own material (a class test's slides or notes), not an official notice",
      }),
    goal: z.object({ id: z.uuid(), kind: z.enum(GoalKind), title: z.string() }),
    kind: z
      .enum(["notice", "modules"])
      .meta({
        description:
          "`notice`: an exam whose notice lists its subjects and topics. `modules`: the plan's own areas",
      }),
    noticeUrl: z
      .string()
      .nullable()
      .meta({ description: "The notice the subjects were read from" }),
    passMarks: z
      .array(z.string())
      .meta({ description: "What it takes to pass, as the notice says it; empty when it doesn't" }),
    questionsSource: z
      .object({ edition: z.string().nullable(), title: z.string().nullable(), url: z.string() })
      .nullable()
      .meta({
        description:
          "Where the subjects' `questions` come from when the notice gives none: the exam's latest edition, as one source counted it",
      }),
    subjects: z
      .array(syllabusSubjectSchema)
      .meta({
        description:
          "The notice's subjects in its order (then areas the plan adds outside it), or the plan's modules in teaching order",
      }),
    topicCount: countSchema,
    topicsMapped: z
      .boolean()
      .meta({
        description: "The plan says which skills teach which topic, so topics have a status",
      }),
    writtenPractice: writtenPracticeSchema
      .nullable()
      .meta({
        description:
          "When the exam's written tests are practiced, which the learner chooses on a written test's page (a subject whose `areas` include one of `parts`) and in the plan. Null for goals without written tests",
      }),
  })
  .meta({ id: "Syllabus" });

export type SyllabusView = z.infer<typeof syllabusViewSchema>;
export type SyllabusSubject = SyllabusView["subjects"][number];
export type SyllabusTopic = SyllabusSubject["topics"][number];
export type SyllabusChapter = SyllabusSubject["chapters"][number];
export type NotPlannedReason = NonNullable<SyllabusTopic["notPlannedReason"]>;
