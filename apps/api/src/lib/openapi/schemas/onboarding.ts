import { examChoiceViewSchema } from "@zoonk/core/exams/choices/contract";
import {
  ONBOARDING_QUESTIONS,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";
import { z } from "zod";
import { goalSchema } from "./goals";
import { playableLibraryLessonResponseSchema } from "./library-lessons";

const onboardingStepSchema = z
  .enum([...ONBOARDING_QUESTIONS, "buddy", "placement", "plan"])
  .meta({ id: "OnboardingStep" });

export const onboardingResponseSchema = z
  .object({
    examChoices: z
      .array(examChoiceViewSchema)
      .meta({
        description:
          "The exam's choices (ENEM's foreign language: English or Spanish), each with its options and the learner's pick (null until made), for the `examChoice` screen; the plan studies only the picked options. Empty for other goals",
      }),
    examDays: z
      .object({
        days: z
          .array(z.iso.date())
          .min(1)
          .meta({
            description: "The sitting's days in order; the first is the plan's default date",
          }),
        estimated: z
          .boolean()
          .meta({ description: "True while the days are estimated, before the notice is out" }),
      })
      .nullable()
      .meta({
        description:
          "The days of the exam's next sitting for a goal started from a public exam course, for the `targetDate` screen to lead with; null for other goals",
      }),
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
      .meta({
        description:
          "An exam's subjects from its stored notice, with only the options of its choices the learner picked; empty for other goals",
      }),
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
    libraryCourse: z
      .object({
        brandSlug: z.string(),
        chapterCount: z.int(),
        courseId: z.uuid().meta({ description: "Open it at GET /v1/courses/{courseId}" }),
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
          "The daily minutes the time question picks first: the time a day picked on a course's page when the goal started there, otherwise from how big the goal is and how soon its or its exam's date is. Only a starting pick; the plan says what that time covers",
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
