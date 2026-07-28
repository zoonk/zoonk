import { MAX_CONTINUE_LEARNING_ITEMS } from "@zoonk/core/courses/continue-learning-contract";
import { z } from "zod";
import { organizationSummarySchema } from "./catalog-resources";
import { paginationSchema } from "./common";
import { lessonKindSchema } from "./curriculum";

const nullableOrganizationSummarySchema = organizationSummarySchema.nullable();

const currentUserCourseSchema = z
  .object({
    description: z.string().nullable(),
    id: z.uuid(),
    imageUrl: z.string().nullable(),
    language: z.string(),
    organization: nullableOrganizationSummarySchema,
    slug: z.string(),
    title: z.string(),
  })
  .meta({ id: "CurrentUserCourse" });

export const currentUserCourseListResponseSchema = z
  .object({ data: z.array(currentUserCourseSchema), pagination: paginationSchema })
  .meta({ id: "CurrentUserCourseListResponse" });

const continuationCourseSchema = z.object({
  id: z.uuid(),
  imageUrl: z.string().nullable(),
  organization: z.object({ slug: z.string() }).nullable(),
  slug: z.string(),
  title: z.string(),
});

const continuationChapterSchema = z.object({ id: z.uuid(), slug: z.string(), title: z.string() });

const continuationLessonSchema = z.object({
  description: z.string().nullable(),
  id: z.uuid(),
  kind: lessonKindSchema,
  slug: z.string(),
  title: z.string().nullable(),
});

const courseContinuationSchema = z
  .discriminatedUnion("status", [
    z.object({
      chapter: continuationChapterSchema,
      course: continuationCourseSchema,
      lesson: continuationLessonSchema.extend({ position: z.number().int().min(0) }),
      status: z.literal("ready"),
    }),
    z.object({
      chapter: continuationChapterSchema,
      course: continuationCourseSchema,
      lesson: continuationLessonSchema.nullable(),
      status: z.literal("pending"),
    }),
  ])
  .meta({ id: "CourseContinuation" });

export const courseContinuationListResponseSchema = z
  .object({
    data: z
      .array(courseContinuationSchema)
      .max(MAX_CONTINUE_LEARNING_ITEMS)
      .meta({ description: "Current continuation targets, ordered by recent learning activity" }),
  })
  .meta({ id: "CourseContinuationListResponse" });

export const lessonVisibilitySchema = z
  .object({ hiddenLessonKinds: z.array(lessonKindSchema) })
  .meta({ id: "LessonVisibility" });

export const lessonVisibilityUpdateSchema = lessonVisibilitySchema.meta({
  id: "LessonVisibilityUpdate",
});
