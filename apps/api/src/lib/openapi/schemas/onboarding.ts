import {
  ONBOARDING_QUESTIONS,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { z } from "zod";
import { goalSchema } from "./goals";
import { playableLibraryLessonResponseSchema } from "./library-lessons";

const onboardingStepSchema = z
  .enum([...ONBOARDING_QUESTIONS, "age", "mode", "buddy", "placement", "plan"])
  .meta({ id: "OnboardingStep" });

export const onboardingResponseSchema = z
  .object({
    examSubjects: z
      .array(z.string())
      .meta({ description: "An exam's subjects from its stored notice; empty for other goals" }),
    followUps: z
      .array(z.string())
      .meta({
        description: "Questions asked about an unusual goal, answered on the `followUps` screen",
      }),
    generationId: z
      .string()
      .nullable()
      .meta({
        description:
          "The run writing the goal's curriculum, followed live at `GET /v1/generations/{generationId}/events`; null until it starts",
      }),
    goal: goalSchema,
    goalIds: z
      .array(z.uuid())
      .meta({ description: "Goals created in the same onboarding, which share the day's time" }),
    isMinor: z
      .boolean()
      .meta({ description: "Under 18: protective defaults apply and a guardian can be invited" }),
    libraryCourse: z
      .object({
        brandSlug: z.string(),
        chapterCount: z.int(),
        courseSlug: z.string(),
        title: z.string(),
      })
      .nullable()
      .meta({
        description:
          "A published Library course that teaches the goal, searched again once every question is answered",
      }),
    steps: z
      .array(onboardingStepSchema)
      .meta({ description: "The screens still ahead, in order, always ending with the plan" }),
  })
  .meta({ id: "Onboarding" }) satisfies z.ZodType<OnboardingView>;

const [readyLessonSchema] = playableLibraryLessonResponseSchema.options;

export const explanationResponseSchema = z
  .object({
    generationId: z
      .string()
      .nullable()
      .meta({
        description:
          "The run writing the explanation, followed live at `GET /v1/generations/{generationId}/events`; null until it starts",
      }),
    goFurther: z.object({
      course: z
        .object({
          brandSlug: z.string(),
          chapterCount: z.int(),
          courseSlug: z.string(),
          description: z.string().nullable(),
          id: z
            .uuid()
            .meta({
              description: "Starts a plan from this course: `POST /v1/courses/{courseId}/goals`",
            }),
          title: z.string(),
        })
        .nullable()
        .meta({ description: "The subject's Overview course" }),
      questions: z.array(z.string()).meta({ description: "Related quick questions" }),
    }),
    goalId: z.uuid(),
    lesson: readyLessonSchema.shape.lesson
      .nullable()
      .meta({
        description:
          "The story screens and the check, without the summary; null while being written",
      }),
    outline: z
      .array(z.string())
      .meta({ description: "The story screens' titles, in order; empty while being written" }),
    question: z.string(),
    recap: z
      .array(z.string())
      .meta({ description: '"Now you know": the summary, one idea per line' }),
    status: z.enum(["preparing", "ready"]),
    title: z.string(),
  })
  .meta({ id: "Explanation" });
