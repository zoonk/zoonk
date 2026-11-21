import { sectionNavigationSchema } from "@zoonk/core/library/exams/blueprint-contract";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { itemCitationSchema } from "./common";
import { itemSetSchema } from "./item-set";

export const mockScoreNotesSchema = z
  .object({
    noticeScoring: z
      .string()
      .nullable()
      .meta({
        description:
          "The notice's own sentence on how the exam is scored, where the mock only counts right answers",
      }),
    relative: z
      .boolean()
      .meta({
        description:
          "The real result depends on everyone in the sitting (a percentile, a standardized score), as the notice says",
      }),
    scale: z
      .object({
        max: z.number(),
        min: z.number(),
        name: z
          .string()
          .nullable()
          .meta({ description: "The scale's name, as the notice gives it" }),
        passScore: z
          .number()
          .nullable()
          .meta({ description: "The score on it that passes, when the notice gives one" }),
        score: z
          .number()
          .nullable()
          .meta({
            description:
              "This mock's right answers on the scale, once it's over, where the map is known (the notice's linear one, or the SAT's, AP's or TOEFL's approximation); null otherwise",
          }),
      })
      .nullable()
      .meta({
        description:
          "The exam's own score scale, shown beside the right answers; null for an exam without one or scored with item response theory",
      }),
  })
  .meta({ id: "MockScoreNotes" });

export const mockSectionSchema = z.object({
  breakAfterMinutes: z
    .number()
    .int()
    .nullable()
    .meta({ description: "The break after it, before the next section's clock starts" }),
  essays: z
    .number()
    .int()
    .min(0)
    .meta({ description: "The essays it asks: a full mock's written part" }),
  index: z.number().int(),
  minutes: z.number().int(),
  name: z.string().nullable(),
  navigation: sectionNavigationSchema
    .nullable()
    .meta({
      description:
        "How it's moved through, as the notice says: `forwardOnly` never goes back to a question once left (PUT answers then refuses one left behind with MOCK_ANSWER_LOCKED, but for `answerChanges` changes in the review at the section's end); `itemSeconds`, each question's own clock (move on when it runs out); `mustAnswer`, answer before moving on. Null: free movement",
    }),
  questions: z.number().int(),
  status: z.enum(["current", "done", "upcoming"]),
  tools: z
    .string()
    .nullable()
    .meta({ description: "What may be used or is given in it, in the notice's words" }),
});

export const mockPlayResponseSchema = z
  .object({
    played: z
      .number()
      .int()
      .min(1)
      .meta({ description: "The plays the mock counted on this recording, this one included" }),
  })
  .meta({ id: "MockPlay" });

export const mockSizeSourceSchema = z
  .object({
    formats: z
      .enum(["even", "notice"])
      .nullable()
      .meta({
        description:
          "How the questions split by answer format: the notice's counts, or evenly because it counts none; null for an exam of one format",
      }),
    material: z
      .boolean()
      .meta({
        description: "A class test read from the learner's own material, which has no notice",
      }),
    pastEdition: z
      .object({ edition: z.string().nullable(), title: z.string().nullable(), url: z.url() })
      .nullable()
      .meta({ description: "The past edition the counts follow, with its source: cite it" }),
    questions: z
      .enum(["notice", "pastEdition", "unstated"])
      .meta({
        description:
          "Where the number of questions comes from: the notice, a past edition, or nowhere (the mock's length is the app's own)",
      }),
    subjects: z
      .enum(["even", "notice", "pastEdition"])
      .nullable()
      .meta({
        description:
          "How the questions split by subject: the notice's counts, a past edition's, or evenly because nothing counts them; null for an exam of one subject",
      }),
    time: z
      .enum(["notice", "unstated"])
      .meta({
        description: "Where the time comes from: the notice, or a usual pace it doesn't state",
      }),
  })
  .meta({
    description: "Where a mock's size comes from, whether or not it's the notice",
    id: "MockSizeSource",
  });

export const mockAdaptSchema = z
  .object({
    focus: z
      .object({ area: z.string(), correct: z.number(), total: z.number().int() })
      .nullable()
      .meta({ description: "The area that went worst, to give more of the plan's time" }),
    skip: z
      .object({ lessons: z.number().int().min(1), topics: z.array(z.string()) })
      .nullable()
      .meta({
        description:
          "The lessons of the topics the mock showed the learner knows (every question right), to skip",
      }),
  })
  .nullable()
  .meta({
    description:
      "What the finished mock offers to change in the plan, each applied only once the learner says so (POST /v1/mocks/{blockId}/plan-changes); null before it's over and for a placement mock",
    id: "MockAdapt",
  });

export const mockVerdictSchema = z
  .object({
    strongest: z
      .string()
      .nullable()
      .meta({ description: "The subject that went best, as `result.areas` names it" }),
    weakest: z
      .string()
      .nullable()
      .meta({ description: "The subject to work on, as `result.areas` names it" }),
  })
  .nullable()
  .meta({
    description:
      "Once it's over: the subject that went clearly best and the one that went clearly worst. Each is null unless its estimated range (without one, its share of right answers, given the same 90% range, with more points too) stands clear of every other subject's: the strongest's bottom above every other's top, the weakest's top below every other's bottom. A part is never measured against the subject it belongs to and the two are never both set, and a mock with no right answer or no miss sets neither. Null before it's over",
    id: "MockVerdict",
  });

export const MOCK_QUESTION_FORMATS = ["multipleChoice", "numeric", "trueFalse", "typed"] as const;

export const mockReviewSchema = z.object({
  area: z.string().nullable(),
  citation: itemCitationSchema,
  context: z
    .string()
    .nullable()
    .meta({ description: "The text the question reads before it, as the mock showed it" }),
  correctAnswer: z.string().nullable(),
  explanation: z.string().nullable(),
  format: z.enum(MOCK_QUESTION_FORMATS),
  itemId: uuidSchema(),
  learnerAnswer: z.string().nullable(),
  number: z.number().int().min(1).meta({ description: "The question's position in its section" }),
  outcome: z
    .enum(["blank", "partial", "wrong"])
    .meta({
      description:
        "`partial`: a question with several picks that earned part of its points, where the notice gives partial credit",
    }),
  question: z.string(),
  section: z.number().int().min(0).optional().meta({ description: "The zero-based section index" }),
  set: itemSetSchema.nullable(),
  total: z
    .number()
    .int()
    .min(1)
    .optional()
    .meta({ description: "The number of numbered questions in this section" }),
});
