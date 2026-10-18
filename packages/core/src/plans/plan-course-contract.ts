import { CourseLevel } from "@zoonk/db";
import { z } from "zod";

const planCourseLevelSchema = z
  .object({
    chapterCount: z
      .int()
      .min(0)
      .meta({ description: "Chapters the course has at this level so far" }),
    inPlan: z.boolean().meta({ description: "The plan teaches chapters from this level" }),
    level: z.enum(CourseLevel),
  })
  .meta({ id: "PlanCourseLevel" });

/**
 * The Library course a plan is built from: "Built from the Statistics course · 14 of 62 chapters ·
 * See full course", and its levels with the plan's marked ("Overview · your plan"). A private
 * course has no levels and no public page.
 */
export const planCourseSchema = z
  .object({
    brandSlug: z
      .string()
      .nullable()
      .meta({
        description: "With `courseSlug`, the course's public page; null for private courses",
      }),
    chapterCount: z.int().min(0).meta({ description: "Chapters in the course, at every level" }),
    courseId: z.uuid(),
    courseSlug: z.string(),
    levels: z
      .array(planCourseLevelSchema)
      .meta({
        description: "Overview to Advanced; empty for private courses, which have no levels",
      }),
    nextLevel: z
      .enum(CourseLevel)
      .nullable()
      .meta({ description: "The level after the plan's highest one; null at the top" }),
    planChapterCount: z.int().min(0).meta({ description: "The course's chapters the plan uses" }),
    title: z.string(),
  })
  .meta({ id: "PlanCourse" });

export type PlanCourseView = z.infer<typeof planCourseSchema>;
export type PlanCourseLevel = z.infer<typeof planCourseLevelSchema>;
