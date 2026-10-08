import {
  ONBOARDING_QUESTIONS,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { z } from "zod";
import { goalSchema } from "./goals";
import { playableLibraryLessonResponseSchema } from "./library-lessons";

const onboardingStepSchema = z
  .enum([...ONBOARDING_QUESTIONS, "age", "memory", "buddy", "placement", "plan"])
  .meta({
    description:
      '`memory` asks a learner under 18, or one whose age is unknown, whether memory may personalize their lessons (it starts off for them); answer it with `{ question: "memory", enabled }`',
    id: "OnboardingStep",
  });

export const onboardingResponseSchema = z
  .object({
    examSubjects: z
      .array(
        z.object({
          name: z.string().meta({ description: "The notice's name, which `knownSubjects` sends" }),
          shortName: z
            .string()
            .nullable()
            .meta({ description: "What learners call it when the notice's name is long" }),
        }),
      )
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
    recommendedMinutes: z
      .int()
      .positive()
      .meta({
        description:
          "The daily minutes the time question picks first, from how soon the goal's or its exam's date is; the plan says what that time covers",
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
    hasStudyGoal: z
      .boolean()
      .meta({
        description:
          "Whether the learner has a goal with a plan besides quick explanations: they go back to Today after this one. Without one, Today has nothing to plan (`GET /v1/today` answers `NO_ACTIVE_GOAL`), so the next step is asking another question",
      }),
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
