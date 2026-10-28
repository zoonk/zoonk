import { type TeachingStepKind } from "@zoonk/core/lesson-player/contract";
import { lessonTutorSuggestionSchema } from "@zoonk/core/lesson-questions/contract";
import { toleranceSchema } from "@zoonk/core/library/activities/schemas";
import { stepContentSchemas } from "@zoonk/core/library/steps/contract";
import { EXERCISE_KINDS } from "@zoonk/core/player/contracts/exercise-content";
import { type LessonFit } from "@zoonk/core/view-models/onboarding/get-lesson-fit";
import { CourseLevel } from "@zoonk/db";
import { z } from "zod";
import { serializedStepSchema } from "./language-exercise";

const stepBaseShape = {
  id: z.uuid(),
  position: z.int().min(0),
  skillId: z
    .uuid()
    .nullable()
    .meta({ description: "The skill the screen teaches or checks, when it has its own" }),
};

const stepImageObjectSchema = z.object({
  alt: z.string(),
  height: z.int().nullable(),
  id: z.uuid().meta({ description: "The image's media asset, to vote on the image itself" }),
  url: z.string(),
  width: z.int().nullable(),
});

const stepImageSchema = stepImageObjectSchema
  .nullable()
  .meta({ description: "The screen's image and its text alternative" });

const stepCitationSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("material"),
      page: z.int().min(1).nullable().meta({ description: "Null for material without pages" }),
      title: z.string(),
      unit: z.enum(["page", "section", "slide"]),
    }),
    z.object({
      checkedAt: z.iso
        .datetime()
        .meta({
          description: 'When the document was last fetched and found current ("Checked Sep 2026")',
        }),
      kind: z.literal("source"),
      publisher: z.string().nullable(),
      title: z.string(),
      url: z.string().nullable().meta({ description: "The official text, when it's online" }),
    }),
    z.object({ kind: z.literal("notInMaterial") }),
  ])
  .nullable()
  .meta({
    description:
      "Where the screen comes from. `material`: the page or slide of the learner's own material, for lessons built from it. `source`: a public document its facts come from (a law, an exam notice), shown as a dated Sources chip. `notInMaterial`: an explanation in a lesson built from the learner's material that no page of it supports",
  });

function teachingStepSchema<TKind extends TeachingStepKind>(kind: TKind) {
  return z.object({
    ...stepBaseShape,
    citation: stepCitationSchema,
    content: stepContentSchemas[kind],
    image: stepImageSchema,
    imagePending: z
      .boolean()
      .meta({
        description:
          "The screen asks for a picture that is still being drawn (the lesson was written moments ago): read the lesson again in a few seconds for `image`",
      }),
    kind: z.literal(kind),
    optionPictures: z
      .record(z.string(), stepImageObjectSchema)
      .optional()
      .meta({
        description:
          "A question whose options are pictures: each drawn picture by option id. An option without one (still being drawn, or taken out of use) shows its `picture.alt`",
      }),
    pictureWaitStartedAt: z
      .number()
      .int()
      .optional()
      .meta({
        description:
          "Original screen-generation time in epoch milliseconds. Missing pictures may arrive for five minutes from this time; reopening does not restart the wait",
      }),
  });
}

const languageStepSchema = z
  .object({
    ...stepBaseShape,
    exercise: serializedStepSchema,
    kind: z.enum(EXERCISE_KINDS),
    wordHints: z
      .object({ note: z.string().nullable(), pronunciationTip: z.string().nullable() })
      .nullable()
      .meta({ description: "The word's usage note and pronunciation tip, when it has either" }),
  })
  .meta({ description: "A language exercise screen: `exercise` holds what it shows and checks" });

const activityStepSchema = teachingStepSchema("activity").extend({
  minTolerance: toleranceSchema
    .nullable()
    .meta({
      description:
        "How far a `numeric` answer may always be from the right one on this template, when the check's own tolerance is tighter (a guess on a slider can't land closer than its steps): right within either. Null when the template has none",
    }),
});

const spokenAnswerStepSchema = teachingStepSchema("spokenAnswer").extend({
  listening: serializedStepSchema
    .nullable()
    .meta({
      description:
        '"I can\'t talk now": the same sentence as a listening exercise to play instead; answer it with a `listening` answer. Null without a sentence behind the screen',
    }),
});

const playableStepSchema = z
  .union([
    activityStepSchema,
    teachingStepSchema("challenge"),
    teachingStepSchema("check"),
    teachingStepSchema("explanation"),
    teachingStepSchema("hook"),
    spokenAnswerStepSchema,
    teachingStepSchema("summary"),
    teachingStepSchema("typedAnswer"),
    teachingStepSchema("workedExample"),
    languageStepSchema,
  ])
  .meta({ id: "PlayableLibraryStep" });

const lessonChapterSchema = z.object({ id: z.uuid(), title: z.string() }).nullable();

const lessonSkillSchema = z.object({ id: z.uuid(), name: z.string() });

const lessonOutlineShape = {
  description: z.string(),
  estimatedMinutes: z.int(),
  id: z.uuid(),
  language: z.string(),
  title: z.string(),
};

export const playableLibraryLessonResponseSchema = z
  .discriminatedUnion("status", [
    z.object({
      lesson: z.object({
        ...lessonOutlineShape,
        canDo: z.string().nullable().meta({ description: "What the learner will be able to do" }),
        chapter: lessonChapterSchema,
        level: z.enum(CourseLevel),
        skills: z.array(lessonSkillSchema),
        steps: z.array(playableStepSchema),
        summaryIdeas: z
          .array(z.string())
          .meta({
            description: "The summary card, each idea in one sentence; empty until it's written",
          }),
        targetLanguage: z.string().nullable(),
      }),
      status: z.literal("ready"),
      tutorSuggestions: z
        .array(lessonTutorSuggestionSchema)
        .meta({
          description:
            "The tutor's suggestions for the lesson's screens, worded in the lesson's language: show `label` on the chip and send `id` as `suggestion` when the learner taps it (`POST /v1/lessons/{lessonId}/questions`). The question is stored in these same words",
        }),
    }),
    z.object({ lesson: z.object(lessonOutlineShape), status: z.literal("notGenerated") }),
    z
      .object({ lesson: z.object(lessonOutlineShape), status: z.literal("sessionRequired") })
      .meta({
        description:
          "A written lesson read without a session: only its public outline. Start a guest session (POST /guests) or sign in, then read it again for its screens",
      }),
  ])
  .meta({ id: "PlayableLibraryLessonResponse" });

export const lessonFitSchema = z
  .object({
    chapter: z.object({
      id: z.uuid(),
      lessonCount: z.int().min(0),
      lessonNumber: z
        .int()
        .min(0)
        .meta({ description: "The lesson's place in its chapter, from 1" }),
      title: z.string(),
    }),
    course: z
      .object({
        chapterCount: z.int().min(0),
        id: z.uuid(),
        minutes: z.int().min(0).meta({ description: "Every lesson of the course, in minutes" }),
        startChapterId: z
          .uuid()
          .nullable()
          .meta({
            description:
              "Where \"Build my plan\" starts the course: this lesson's chapter, or null for the course's beginning (POST /courses/{courseId}/goals with it)",
          }),
        title: z.string(),
      })
      .nullable()
      .meta({ description: "The public course the chapter is part of; null outside one" }),
  })
  .meta({
    description:
      'Where a public lesson fits, for the end of a guest\'s lesson: its chapter and place in it, and the course "Build my plan" starts',
    id: "LessonFit",
  }) satisfies z.ZodType<LessonFit>;
