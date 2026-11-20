import { z } from "zod";
import { examDocumentSchema } from "../../exams/exam-document";
import { goalReferenceSchema } from "../../goals/goal-reference-schema";
import { passMarksSchema } from "../../library/exams/pass-marks";
import { sharedExamsSchema } from "../../plans/shared-exams-contract";
import { writtenPracticeSchema } from "../../plans/written-practice-contract";
import { syllabusSubjectSchema } from "./syllabus-subject-contract";

export { notPlannedReasonSchema } from "./syllabus-subject-contract";

const countSchema = z.int().min(0);

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
    goal: goalReferenceSchema,
    hasNotice: z
      .boolean()
      .optional()
      .describe("Whether the exam has a source guide or the learner supplied test material."),
    kind: z
      .enum(["notice", "modules"])
      .meta({
        description:
          "`notice`: an exam whose notice lists its subjects and topics. `modules`: the plan's own areas",
      }),
    knownTopicsReturn: z
      .enum(["practice", "reviews"])
      .meta({ description: "Where a known topic comes back to be confirmed. Always practice" }),
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
    sharedExams: sharedExamsSchema,
    subjectCount: countSchema
      .optional()
      .describe("The number of subjects excluding optional exam study."),
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
