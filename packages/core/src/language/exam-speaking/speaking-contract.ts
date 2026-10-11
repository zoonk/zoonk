import { SPEAKING_EXAMS } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { z } from "zod";

const speakingExamSchema = z
  .enum(SPEAKING_EXAMS)
  .meta({
    description: "DELE, DELF or DALF, the Goethe-Zertifikat, or Cambridge English",
    id: "SpeakingExam",
  });

const minutesSchema = z.object({ max: z.number(), min: z.number() });

const speakingTaskViewSchema = z
  .object({
    key: z.string().meta({ description: "The task's key in its paper: `t1`, `p2`" }),
    minutes: minutesSchema.meta({ description: "The task's official speaking time" }),
    mode: z.enum(["monologue", "interaction", "monologueThenInteraction", "rolePlay"]),
    name: z.string().meta({ description: "The official name, in the exam's language" }),
    options: z.int().meta({ description: "How many cards the exam offers to choose from" }),
    prepMinutes: z
      .number()
      .meta({ description: "The preparation the exam gives it, or its share; 0 for none" }),
    prepShared: z
      .object({
        minutes: z.number(),
        tasks: z.array(z.int()).meta({ description: "The numbers of the tasks it covers, from 1" }),
      })
      .nullable()
      .meta({
        description:
          "The exam's preparation when several tasks share it (DELE B2: 20 minutes for Tasks 1 and 2); `prepMinutes` is then this task's share. Null when it's the task's own",
      }),
    role: z
      .enum(["examiner", "partner"])
      .meta({ description: "Whom the AI plays: the examiner, or the other candidate" }),
    stimulus: z.enum(["topic", "photos", "text", "data"]),
  })
  .meta({ id: "SpeakingTask" });

export type SpeakingTaskView = z.infer<typeof speakingTaskViewSchema>;

/** A task as the goal's paper lists it: what it's rated on, and the learner's last try at it. */
const speakingPaperTaskSchema = speakingTaskViewSchema
  .extend({
    criteria: z
      .array(z.object({ key: z.string(), name: z.string() }))
      .meta({ description: "The official criteria the task is rated on, in the exam's language" }),
    lastTry: z
      .object({
        atLevel: z.int().meta({ description: "How many of its estimates reach the exam's level" }),
        conversationId: z.uuid().meta({ description: "The call, to see its result again" }),
        nearLevel: z
          .int()
          .meta({ description: "How many only reach it at the top of their range" }),
        rated: z.int().meta({ description: "How many criteria it has an estimate on; 0 for none" }),
      })
      .nullable()
      .meta({ description: "The learner's last finished try of this task on this goal" }),
  })
  .meta({ id: "SpeakingPaperTask" });

export type SpeakingPaperTaskView = z.infer<typeof speakingPaperTaskSchema>;

const speakingPassRuleSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("group"), min: z.number(), of: z.number() }),
    z.object({ kind: z.literal("paper"), min: z.number() }),
    z.object({ kind: z.literal("floor"), min: z.number() }),
    z.object({ kind: z.literal("none") }),
  ])
  .meta({
    description:
      "The paper's own rule: a minimum shared with another paper (`group`, DELE's with listening), its own minimum (`paper`), a floor below which the whole exam fails (`floor`, DELF), or none",
    id: "SpeakingPassRule",
  });

const paperFields = {
  exam: speakingExamSchema,
  language: z.string().meta({ description: "The exam's language: es, fr, de or en" }),
  level: z.enum(CEFR_LEVELS),
  paper: z.string().meta({ description: "The speaking paper's official name" }),
  source: z.string().meta({ description: "The exam owner's page the format comes from" }),
  title: z.string().meta({ description: "The exam and level: DELE B2, B2 First" }),
};

/** A certificate's speaking paper as a goal shows it: its tasks, to practice one at a time. */
export const speakingPaperViewSchema = z
  .object({
    ...paperFields,
    access: z
      .enum(["open", "plusRequired"])
      .meta({ description: "Speaking tasks come with Plus; free learners see them locked" }),
    minutes: minutesSchema.meta({ description: "The paper's official speaking time" }),
    prepMinutes: z.number(),
    prepTasks: z
      .array(z.string())
      .meta({ description: "The tasks the paper's preparation covers" }),
    tasks: z.array(speakingPaperTaskSchema),
  })
  .meta({ id: "SpeakingPaper" });

export type SpeakingPaperView = z.infer<typeof speakingPaperViewSchema>;

/** A task card as the candidate gets it, in the exam's language, and what to do in theirs. */
const speakingCardSchema = z
  .object({
    instructions: z.array(z.string()).meta({ description: "In the exam's language" }),
    photos: z.array(z.object({ alt: z.string(), url: z.string() })),
    prompts: z
      .array(z.string())
      .meta({
        description: "Points to cover, questions, proposals or slides, in the exam's language",
      }),
    summary: z.string().meta({ description: "What the candidate does, in the learner's language" }),
    table: z
      .object({
        columns: z.array(z.string()),
        rows: z.array(z.array(z.string())),
        title: z.string(),
      })
      .nullable(),
    text: z.object({ body: z.string(), title: z.string() }).nullable(),
  })
  .meta({ id: "SpeakingCard" });

export type SpeakingCard = z.infer<typeof speakingCardSchema>;

/** What an exam task's call keeps of its paper: the exam, the level, the task and its card. */
export const examTaskSnapshotSchema = z.object({
  card: speakingCardSchema,
  exam: speakingExamSchema,
  level: z.enum(CEFR_LEVELS),
  task: z.string(),
});

export type ExamTaskSnapshot = z.infer<typeof examTaskSnapshotSchema>;

const speakingCriterionViewSchema = z
  .object({
    display: z
      .enum(["band", "letter", "points"])
      .meta({ description: "A band number, a letter (A best), or the points the band gives" }),
    halfBands: z.boolean(),
    key: z.string(),
    levelBand: z
      .int()
      .nullable()
      .meta({ description: "The band the scale writes for the exam's level, when it names one" }),
    levelMark: z
      .number()
      .meta({
        description:
          "The band from which an estimate reaches the exam's level: `levelBand`, or 60% of the scale where the exam passes from 60% (Goethe)",
      }),
    maxBand: z.int(),
    name: z.string().meta({ description: "The official name, in the exam's language" }),
    points: z
      .array(z.number())
      .nullable()
      .meta({ description: "The points each band gives on this task's line; null when none" }),
    sound: z
      .boolean()
      .meta({ description: "How the candidate sounds, graded for intelligibility, never accent" }),
    voiceOnly: z
      .boolean()
      .meta({
        description: "Only the candidate's voice shows it, so typed replies aren't rated on it",
      }),
  })
  .meta({ id: "SpeakingCriterion" });

export type SpeakingCriterionView = z.infer<typeof speakingCriterionViewSchema>;

/** One exam task's call: its paper, the task with its card, its criteria and its timing cues. */
export const examTaskViewSchema = z
  .object({
    ...paperFields,
    card: speakingCardSchema,
    criteria: z.array(speakingCriterionViewSchema),
    cues: z
      .array(z.object({ atSeconds: z.int(), say: z.string() }))
      .meta({
        description:
          "What to tell the voice model (as a context append) when the call has run this long, as an examiner keeps time",
      }),
    nextTask: z
      .string()
      .nullable()
      .meta({
        description: "The paper's next task's key, to open it after this one; null for the last",
      }),
    number: z.int().meta({ description: "The task's place in its paper, from 1" }),
    sectionId: z
      .uuid()
      .nullable()
      .meta({ description: "The whole paper this task belongs to; null for a single task" }),
    task: speakingTaskViewSchema,
    taskCount: z.int(),
  })
  .meta({ id: "ExamSpeakingTask" });

export type ExamTaskView = z.infer<typeof examTaskViewSchema>;

const criterionGradeSchema = z.object({
  bandHigh: z.number(),
  bandLow: z.number(),
  criterion: z.string(),
  evidence: z.string(),
  tip: z.string(),
});

/** An exam task's estimated bands on its official criteria, never an official score. */
export const examSpeakingFeedbackSchema = z
  .object({
    brief: z
      .boolean()
      .meta({
        description: "The candidate said too little to judge well; the result says so once",
      }),
    criteria: z.array(criterionGradeSchema),
    focus: z.string().meta({ description: "The criterion to work on first" }),
    heard: z
      .boolean()
      .meta({
        description:
          "The candidate spoke rather than only typed; typed tasks have no grade on criteria only the voice shows",
      }),
    kind: z.literal("examSpeaking"),
  })
  .meta({ id: "ExamSpeakingFeedback" });

export type ExamSpeakingFeedback = z.infer<typeof examSpeakingFeedbackSchema>;

/** A whole speaking paper taken task by task, as a mock's speaking section. */
export const speakingSectionViewSchema = z
  .object({
    ...paperFields,
    estimate: z
      .object({
        complete: z.boolean(),
        high: z.number().nullable(),
        low: z.number().nullable(),
        total: z.number(),
        typed: z
          .boolean()
          .meta({
            description:
              "A task was answered by typing, so the lines only the voice shows have no band and the paper no points",
          }),
      })
      .meta({
        description:
          "The estimated points on the paper's own total once every task is graded, never an official score",
      }),
    id: z.uuid(),
    pass: speakingPassRuleSchema,
    prepMinutes: z.number(),
    prepTasks: z.array(z.string()),
    tasks: z.array(
      speakingTaskViewSchema.extend({
        conversationId: z.uuid(),
        status: z.enum(["ready", "completed"]),
      }),
    ),
  })
  .meta({ id: "SpeakingSection" });

export type SpeakingSectionView = z.infer<typeof speakingSectionViewSchema>;
