import { z } from "zod";
import { dailyMinutesSchema, goalCreateInputSchema } from "../goals/goal-contract";
import { planNumbersSchema, planWorkloadSchema } from "../plans/numbers-contract";
import { MAX_PLAN_DAYS } from "../plans/target-date-range";

export const coursePlanEstimateInputSchema = z
  .object({
    courseId: z.uuid(),
    dailyMinutes: dailyMinutesSchema,
    studyDays: goalCreateInputSchema.shape.studyDays
      .unwrap()
      .refine((days) => new Set(days).size === days.length, {
        message: "Study days must be unique",
      }),
    targetDate: z.iso
      .date()
      .optional()
      .describe(
        `Optional deadline, from tomorrow through calendar day ${MAX_PLAN_DAYS} after today's UTC date, inclusive. An out-of-range date returns 400 VALIDATION_ERROR. Omit it for an undated estimate.`,
      ),
  })
  .strict();

const weekSchema = z.int().min(1).nullable();
const areaSchema = z.string().nullable();

const publishedContentSchema = z
  .object({ lessons: z.int().nonnegative(), minutes: z.number().nonnegative() })
  .describe(
    "Unique original published outline lessons and raw authored minutes; excludes sampled pace, quick replacements, unwritten work, practice and milestones. Not the scheduled workload or the whole exam curriculum.",
  );

const courseEstimateLessonSchema = z.object({
  chapterId: z.uuid().nullable(),
  dayMinutes: z
    .number()
    .nonnegative()
    .describe(
      "Actual scheduled study minutes for this lesson on the first date, including its allocated practice. A long lesson can continue on later dates; this is distinct from its whole estimatedMinutes.",
    ),
  estimatedMinutes: z
    .number()
    .positive()
    .describe("Sampled duration of the whole authored lesson."),
  lessonId: z.uuid(),
  title: z.string(),
});

const courseEstimateChapterSchema = z.object({
  chapterId: z.uuid(),
  endWeek: weekSchema.describe(
    "Week when the actual teaching interval of the chapter's planned written or quick work ends. Null means no covered work or an unknown completion date for unwritten aggregate work; week and workKinds distinguish these cases.",
  ),
  week: weekSchema.describe(
    "First scheduled week of chapter-linked original, quick, or unwritten lesson work; null when none is planned.",
  ),
  workKinds: z
    .array(z.enum(["original", "quick", "unwritten"]))
    .describe(
      "Kinds of actually planned chapter-linked lesson work. Original means published outline refs; quick means their skill's written quick replacement; unwritten means covered skill lessons still to be written. Does not imply every chapter concept or original lesson fits.",
    ),
});

export const coursePlanEstimateSchema = z
  .union([
    z.object({
      chapters: z.array(courseEstimateChapterSchema),
      endDate: z.iso.date().nullable(),
      firstDay: z.array(courseEstimateLessonSchema),
      numbers: planNumbersSchema,
      publishedContent: publishedContentSchema,
      weeks: z.int().min(0),
      workload: planWorkloadSchema,
    }),
    z.object({
      areas: z.array(
        z.object({
          area: areaSchema,
          fitting: z.int().min(0),
          plannedMinutes: z
            .number()
            .nonnegative()
            .describe(
              "Covered lesson minutes, including quick lessons and unwritten curriculum, excluding practice and checkpoints. Shared outline lesson time is divided equally across its distinct published chapter areas.",
            ),
          quickLessons: z
            .int()
            .min(0)
            .describe(
              "Written quick lessons planned instead of full outline lessons; not included in fitting.",
            ),
          total: z.int().min(0),
          unwrittenMinutes: z
            .number()
            .nonnegative()
            .describe(
              "Covered lesson minutes still to be written, including missing quick versions.",
            ),
        }),
      ),
      chapters: z.array(
        courseEstimateChapterSchema.extend({
          area: areaSchema,
          lessonsInPlan: z.int().min(0),
          studyOrder: z.int().min(1),
        }),
      ),
      fittingLessons: z.int().min(0),
      numbers: planNumbersSchema,
      publishedContent: publishedContentSchema,
      workload: planWorkloadSchema,
    }),
  ])
  .meta({ id: "CoursePlanEstimate" });

export type CoursePlanEstimateInput = z.infer<typeof coursePlanEstimateInputSchema>;
export type CoursePlanEstimate = z.infer<typeof coursePlanEstimateSchema>;
