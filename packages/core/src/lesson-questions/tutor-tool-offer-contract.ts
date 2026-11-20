import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { WRITTEN_CADENCES } from "../plans/planner/plan-state";
import { practiceCallSchema } from "../view-models/language/language-view-contract";

const tutorOfferAccessSchema = z
  .enum(["open", "plusRequired"])
  .meta({
    description:
      "plusRequired: the learner's plan doesn't include it and Plus does, so it can't start",
  });

const tutorOfferCourseSchema = z
  .object({
    brandSlug: z.string(),
    description: z.string().nullable(),
    id: uuidSchema(),
    imageUrl: z.string().nullable(),
    slug: z.string(),
    title: z.string(),
  })
  .strict();

function placeOfferSchema<Kind extends string>({
  description,
  kind,
}: {
  description: string;
  kind: Kind;
}) {
  return z.object({ kind: z.literal(kind).meta({ description }) }).strict();
}

export const tutorToolOfferSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        access: tutorOfferAccessSchema,
        course: tutorOfferCourseSchema
          .nullable()
          .meta({ description: "A catalog course that teaches the subject, when one matches" }),
        goal: z
          .string()
          .meta({ description: "What the learner wants, in their words, filled in to start it" }),
        kind: z.literal("startGoal"),
      })
      .strict(),
    z
      .object({
        chapterId: uuidSchema().meta({
          description: "The chapter whose test-out to start (`POST …/test-out/generations`)",
        }),
        chapterTitle: z.string(),
        goalId: uuidSchema(),
        kind: z.literal("chapterTest"),
        lessonsLeft: z
          .int()
          .min(1)
          .meta({ description: "Lessons of the plan passing the test can skip" }),
      })
      .strict(),
    z
      .object({
        goalId: uuidSchema(),
        kind: z
          .literal("chooseFocus")
          .meta({ description: "Choosing which subjects get the plan's depth, or the focus test" }),
      })
      .strict(),
    z
      .object({
        call: practiceCallSchema,
        chapterId: uuidSchema().meta({
          description: "The unit whose practice call to start (`kind: practice`)",
        }),
        goalId: uuidSchema(),
        kind: z.literal("conversationCall"),
        unitTitle: z.string(),
      })
      .strict(),
    z
      .object({
        access: tutorOfferAccessSchema,
        goalId: uuidSchema(),
        kind: z
          .literal("mockExam")
          .meta({
            description:
              "Choosing a mock exam to take now (`GET /v1/goals/{goalId}/mocks`), or continuing the one started",
          }),
        subjects: z
          .array(z.string())
          .meta({
            description:
              "The subjects a mock can also be on alone, besides the full exam, the biggest first; empty when none can",
          }),
      })
      .strict(),
    z
      .object({
        access: tutorOfferAccessSchema,
        cadence: z.enum(WRITTEN_CADENCES).meta({ description: "When the plan practices it" }),
        goalId: uuidSchema(),
        kind: z
          .literal("essay")
          .meta({ description: "The exam's written test, as its subject's page in the plan" }),
        subject: z
          .string()
          .meta({ description: "The written test's subject, as the syllabus names it" }),
        subjectKey: z
          .string()
          .meta({ description: "The subject's key in the goal's syllabus (`GET …/syllabus`)" }),
      })
      .strict(),
    z
      .object({
        goalId: uuidSchema(),
        kind: z.literal("mistakes").meta({ description: "The goal's mistakes notebook" }),
        open: z.int().min(1).meta({ description: "Mistakes waiting to be fixed" }),
      })
      .strict(),
    z
      .object({
        count: z.int().min(1).meta({ description: "Words due to be said again" }),
        goalId: uuidSchema(),
        kind: z
          .literal("pronunciation")
          .meta({ description: "Saying again the words the learner mispronounced" }),
        words: z.array(z.string()).meta({ description: "The first few of them" }),
      })
      .strict(),
    z
      .object({
        goalId: uuidSchema(),
        kind: z
          .literal("variety")
          .meta({
            description:
              "The goal's language as one country speaks it, for the buddy and practice calls: Apply is `PATCH /goals/{goalId}` with this `targetRegion`, and nothing changes before it",
          }),
        languageFlag: z
          .string()
          .nullable()
          .meta({
            description:
              "The offered country's flag, as flag-icons names it: what the goal's `languageFlag` becomes once applied",
          }),
        targetLanguage: z.string(),
        targetRegion: z.string().meta({ description: "The country offered, a two-letter code" }),
        taughtRegion: z
          .string()
          .meta({ description: "The country whose variety lessons and their audio keep" }),
      })
      .strict(),
    z
      .object({
        country: z.string(),
        countryName: z.string(),
        goalId: uuidSchema(),
        kind: z.enum(["contentCountry", "homeCountry"]),
        languageFlag: z.string(),
        lessonVariety: z.object({ language: z.string(), region: z.string() }).nullable(),
      })
      .strict(),
    placeOfferSchema({ description: "The learner's statistics", kind: "stats" }),
    placeOfferSchema({ description: "The learner's week in review", kind: "logbook" }),
    placeOfferSchema({ description: "What the app remembers about the learner", kind: "memory" }),
    z
      .object({
        kind: z.literal("plus").meta({ description: "The Plus plan's page" }),
        subscribed: z.boolean().meta({ description: "The learner already has Plus" }),
      })
      .strict(),
  ])
  .meta({ id: "TutorToolOffer" });

export type TutorToolOffer = z.infer<typeof tutorToolOfferSchema>;
