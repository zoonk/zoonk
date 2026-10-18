import { sectionNavigationSchema } from "@zoonk/core/library/exams/blueprint-contract";
import { z } from "zod";

/** What a mock's result says about the real score, beside its own. */
export const mockScoreNotesSchema = z
  .object({
    noticeScoring: z
      .string()
      .nullable()
      .meta({
        description:
          "The notice's own sentence on how the exam is scored, where the mock only counts right answers: show it with the result",
      }),
    relative: z
      .boolean()
      .meta({
        description:
          "The real result depends on everyone in the sitting (a percentile, a standardized score): say the mock shows right answers only",
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

/** One section of a mock, in the exam's order, with how it's moved through and what it allows. */
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
          "How the questions split by answer format: the notice's counts, or evenly because it counts none (say so); null for an exam of one format",
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
          "Where the number of questions comes from: the notice, a past edition, or nowhere (say the mock's length is the app's own)",
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
    description:
      "Where a mock's size comes from: say so on the mock whenever it isn't the notice, never inventing a number",
    id: "MockSizeSource",
  });
