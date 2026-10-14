import { GoalKind } from "@zoonk/db";
import { z } from "zod";
import { displayWeightSchema } from "../../exams/display-weight-contract";
import { examDocumentSchema } from "../../exams/exam-document";
import { TOPIC_FREQUENCY_LEVELS } from "../../library/exams/blueprint-contract";
import { passMarksSchema } from "../../library/exams/pass-marks";
import { writtenPracticeSchema } from "../../plans/written-practice-contract";

const countSchema = z.int().min(0);
const shareSchema = z.number().min(0).max(1);
const isoDateSchema = z.iso.date();

/**
 * Why a topic or a subject isn't in the plan: the learner took it out, they start past it, they
 * chose to skip it as a base, time, or nothing teaches it yet.
 */
const notPlannedReasonSchema = z
  .enum(["skipped", "pastBasics", "skippedBase", "time", "missing"])
  .nullable()
  .meta({
    description:
      "Why it isn't in the plan: `skipped` (the learner took the subject out; `restoreAreas` with its `areas` brings it back), `pastBasics` (a subject's basics the plan starts past: the learner said they know them, or does well in the subject with harder lessons), `skippedBase` (a base the learner chose to skip; `setBaseChoices` with `learn` brings it back), `time` (it doesn't fit before the deadline at the current pace), `missing` (no skill of the plan teaches it yet). Null when it's in the plan",
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
    far: z
      .boolean()
      .meta({
        description:
          "A topic whose lessons aren't written yet and start after the two weeks the plan writes ahead: say the lessons the plan teaches it (`plannedLessons`, about that many) and when it starts (`nextDate`), not that they're on the way. False for every other row",
      }),
    known: z
      .boolean()
      .meta({
        description:
          "Done only because the learner showed they know it: every lesson tested out, none studied. Say it was skipped, apart from the chapters done",
      }),
    lessonsDone: countSchema,
    lessonsTotal: countSchema,
    nextDate: isoDateSchema
      .nullable()
      .meta({ description: "The next day the plan studies it; null once it's done" }),
    plannedLessons: z
      .int()
      .min(1)
      .nullable()
      .meta({
        description:
          "A topic's lessons the plan teaches while they aren't written yet, after its cuts and base choices. Null for a chapter, and for a topic of a plan saved before it stored them (until its next change): say no count then",
      }),
    position: z
      .int()
      .min(1)
      .meta({
        description:
          "Its number in the subject, in the subject's order (the ones done first): every screen calls it Chapter 4",
      }),
    skillId: z
      .uuid()
      .nullable()
      .meta({
        description:
          "A `far` topic no chapter teaches yet: its skill, whose lesson plan is `GET /v1/goals/{goalId}/skills/{skillId}/outline` (POST `.../outline/generations` writes it now). Null for a chapter, for a topic whose lessons are on the way, and for one chapters already teach (the plan writes its next chapter as the learner gets close)",
      }),
    state: z
      .enum(["done", "current", "upcoming"])
      .meta({ description: "`current` holds the plan's next lesson; at most one chapter has it" }),
    title: z.string(),
    writing: z
      .boolean()
      .meta({
        description:
          "A topic whose lessons aren't written yet (the plan writes them two weeks ahead). One starting after those weeks is `far`; any other's lessons are on the way",
      }),
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
          "The heading the notice lists it under inside its subject, such as physics in ENEM's natural sciences: topics with the same heading come together, in order. Null when the subject has no headings",
      }),
    name: z.string().meta({ description: "In the source's own words, as the notice lists it" }),
    nextDate: isoDateSchema
      .nullable()
      .meta({ description: "When the plan studies it next; null once studied or when unknown" }),
    notPlannedReason: notPlannedReasonSchema,
    status: z
      .enum(["studied", "known", "inProgress", "toStudy", "notPlanned"])
      .nullable()
      .meta({
        description:
          "From the plan's lessons on it. `known`: the learner showed they know it (a right answer in placement or a test, or a test-out), so the plan has no lessons on it; practice still asks it, and a miss brings its lessons back. In a subject the learner took out, a topic they studied lessons of keeps `studied` (or `known`) and its `chapters`, with `notPlannedReason` `skipped`. A topic whose lessons left were set aside after missed days is out for time (`notPlannedReason` `time`): `notPlanned`, or `inProgress` with the `chapters` the learner studied of it. Null when the plan doesn't say which skills teach which topic (plans made before topics were mapped): show the topic without a status",
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
    displayWeight: displayWeightSchema,
    group: z
      .string()
      .nullable()
      .meta({ description: "The notice's grouping, such as its basic knowledge part (P1)" }),
    imageUrl: z
      .string()
      .nullable()
      .meta({ description: "The icon of the Library course the plan teaches it with" }),
    key: z
      .string()
      .meta({ description: "Stable within the goal's syllabus, URL-safe: the subject's page" }),
    lessonsDone: countSchema.meta({
      description:
        "Its lessons the learner studied, never ones the plan set aside or they tested out of (`lessonsKnown`), so taking test-out credit back never lowers it",
    }),
    lessonsKnown: countSchema.meta({
      description:
        'Its lessons the learner skipped because they showed they know them (tested out); a miss on one of those topics brings them back to study, lowering this, never `lessonsDone`. Show apart: "25 skipped because you know them"',
    }),
    lessonsTotal: countSchema.meta({
      description:
        "Its size: the lessons the plan teaches in it, studied, known, to do or set aside (a plan without a date leaves out the ones the Library couldn't write), so finishing the plan reads 100%. Changing the learner's time or date changes what the plan holds, and so this; never `lessonsDone`",
    }),
    mastery: z
      .object({ answered: countSchema, correct: countSchema })
      .nullable()
      .meta({
        description:
          "An exam subject's first answers to questions never seen before that say how well it's known, once it has the few its `preparation` needs to count mastery: show as \"6 of 8 right\". Null before, while its preparation counts no mastery yet: say it shows after a few practice questions. Null too whenever `preparation` is null",
      }),
    matrix: z
      .array(z.string())
      .meta({
        description:
          "When the notice's syllabus for it is a skills matrix (ENEM's competencies and abilities) and its `topics` are the contents the matrix is paired with: the matrix's statements, word for word, as detail. Empty otherwise",
      }),
    name: z.string().meta({ description: "The notice's own name for it, or the module's" }),
    nextDate: isoDateSchema
      .nullable()
      .meta({ description: "The next day the plan studies it; null once done or out of the plan" }),
    notPlannedReason: notPlannedReasonSchema,
    preparation: shareSchema
      .nullable()
      .meta({
        description:
          "An exam goal's preparation in this subject, on the same scale as the goal's (`GET /v1/goals/{goalId}/preparation`): the goal's rule on the subject's skills and answers, with the goal's mock exams, which test every subject. The goal's preparation is its subjects' together, each counting by how much it weighs, so it never sits outside them. Show it as the subject's number and bar, with `mastery` saying how much of it practice backs. A subject out of the plan (`notPlannedReason`) that the goal still counts (left out for time, its basics passed or its bases skipped, the exam testing it, with a section that weighs in the goal) has it too: show the number muted beside why it's out, with no bar. Null for other goals, whose subjects' progress is their lessons (`lessonsDone` and `lessonsKnown` of `lessonsTotal`), and for a subject out of the plan the goal doesn't count (`skipped` by the learner, `missing`, or weighing nothing in the goal)",
      }),
    questions: countSchema
      .nullable()
      .meta({ description: "Questions on it in the exam, when the notice says" }),
    share: shareSchema
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
    topicsKnown: countSchema
      .nullable()
      .meta({
        description:
          "Topics `known` (the learner showed they know them), shown apart from the ones studied; null when the plan doesn't map topics",
      }),
    topicsStudied: countSchema
      .nullable()
      .meta({ description: "Topics `studied`; null when the plan doesn't map topics" }),
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
    examDocument: examDocumentSchema,
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
    knownTopicsReturn: z
      .enum(["practice", "reviews"])
      .meta({
        description:
          "Where a `known` topic comes back to be confirmed: `practice`, or `reviews` for a free exam plan past its first week, whose practice is Plus (the quick review asks it then)",
      }),
    lessons: z
      .object({
        done: countSchema.meta({ description: "Studied or skipped as known" }),
        known: countSchema.meta({
          description:
            "Of `done`, the ones skipped because the learner showed they know them, each counted once even when it shows in several subjects; the rest were studied",
        }),
        total: countSchema,
      })
      .meta({
        description:
          "The lessons of the subjects in the plan (`notPlannedReason` null), added up: a goal that isn't an exam reads its progress as `done` of `total`, the same as its subjects' bars, so it reads 100% once every lesson of the plan is studied or known (with its phases' challenges won, the plan's status is then `finished`)",
      }),
    noticeUrl: z
      .string()
      .nullable()
      .meta({ description: "The notice the subjects were read from" }),
    passMarks: passMarksSchema
      .nullable()
      .meta({ description: "What it takes to pass, as the notice says it; null when it doesn't" }),
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
      .describe("The plan says which skills teach which topic, so topics have a status"),
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
