import { trackInputSchema, trackUpdateSchema } from "@zoonk/core/courses/track-contract";
import { z } from "zod";
import { resourcePageQuerySchema } from "./catalog-resources";
import { paginationSchema } from "./common";
import { courseFormatSchema } from "./curriculum";
import { courseLearningTargetSchema, startCourseResponseSchema } from "./learning-plan";

export const trackCreateRequestSchema = trackInputSchema.meta({ id: "TrackCreateRequest" });

export const trackUpdateRequestSchema = trackUpdateSchema.meta({
  id: "TrackUpdateRequest",
  override: { minProperties: 1 },
});

export const trackListQuerySchema = resourcePageQuerySchema.meta({ id: "TrackListQuery" });

export const trackPathParamsSchema = z
  .object({ trackId: z.uuid().meta({ description: "Track ID" }) })
  .meta({ id: "TrackPathParams" });

const trackCourseProgressSchema = z.object({
  completedChapters: z.number().int().min(0),
  completedLessons: z.number().int().min(0),
  pendingChapters: z
    .number()
    .int()
    .min(0)
    .meta({
      description:
        "Selected chapters whose lesson outlines are not ready; lesson totals remain incomplete while this is nonzero",
    }),
  totalChapters: z.number().int().min(0),
  totalLessons: z.number().int().min(0),
});

const trackCourseSchema = z.object({
  brandSlug: z.string(),
  format: courseFormatSchema,
  id: z.uuid(),
  imageUrl: z.string().nullable(),
  position: z.number().int().nonnegative(),
  progress: trackCourseProgressSchema,
  slug: z.string(),
  title: z.string(),
});

export const trackResponseSchema = z
  .object({
    courses: z.array(trackCourseSchema),
    createdAt: z.iso.datetime(),
    id: z.uuid(),
    nextTarget: courseLearningTargetSchema.nullable(),
    pendingCourses: z.array(
      z.object({ coursePromptId: z.uuid(), position: z.number().int().min(0), title: z.string() }),
    ),
    progress: z.object({
      completedCourses: z.number().int().min(0),
      completedLessons: z.number().int().min(0),
      pendingChapters: z.number().int().min(0),
      totalCourses: z.number().int().min(0),
      totalLessons: z.number().int().min(0),
    }),
    title: z.string(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "TrackResponse" });

export const trackListResponseSchema = z
  .object({ data: z.array(trackResponseSchema), pagination: paginationSchema })
  .meta({ id: "TrackListResponse" });

export const startTrackResponseSchema = z.union([
  startCourseResponseSchema,
  z.object({
    brandSlug: z.string(),
    courseId: z.uuid(),
    courseSlug: z.string(),
    status: z.literal("needsPlan"),
  }),
  z.object({
    resource: z.literal("coursePrompt"),
    resourceId: z.uuid(),
    status: z.literal("generationRequired"),
    trackId: z.uuid(),
  }),
  z.object({ status: z.literal("completed"), track: trackResponseSchema }),
]);
