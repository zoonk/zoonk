import { CourseLevel, GoalKind } from "@zoonk/db";
import { z } from "zod";
import { skillStateCountsSchema } from "../../learner/contract";
import { mapSkillSchema } from "../map/map-contract";

const chapterLessonSchema = z
  .object({
    lessonId: z.uuid(),
    minutes: z.int().min(0),
    skillIds: z
      .array(z.uuid())
      .meta({ description: "Skills it teaches, so tapping a skill on the map lists its lessons" }),
    state: z
      .enum(["done", "next", "upcoming"])
      .meta({ description: "`next` is the lesson to open now; at most one lesson has it" }),
    title: z.string(),
  })
  .meta({ id: "ChapterLesson" });

/**
 * A chapter of the learner's plan, the same view model for Focus and Fun: its map (the chapter's
 * skills linked by prerequisites, each with its mastery), its lessons with the next one to open,
 * open mistakes on its skills to practice and the summary cards its finished lessons left.
 */
export const chapterViewSchema = z
  .object({
    chapter: z.object({
      chapterId: z.uuid(),
      level: z.enum(CourseLevel),
      position: z
        .int()
        .min(1)
        .meta({ description: "Its number in the plan: Chapter 3 · Overview" }),
      state: z.enum(["done", "current", "upcoming"]),
      title: z.string(),
    }),
    counts: skillStateCountsSchema,
    goal: z.object({ id: z.uuid(), kind: z.enum(GoalKind), title: z.string() }),
    lessons: z
      .array(chapterLessonSchema)
      .meta({ description: "The plan's lessons in this chapter" }),
    mistakes: z.object({
      open: z
        .int()
        .min(0)
        .meta({
          description:
            "Open mistakes on the chapter's skills; practice them with `POST /v1/goals/{goalId}/area-practice` and the chapter id as `areaId`",
        }),
    }),
    skills: z.array(mapSkillSchema).meta({ description: "The chapter's map, in plan order" }),
    summaries: z
      .array(z.object({ ideas: z.array(z.string()), lessonId: z.uuid(), title: z.string() }))
      .meta({ description: "Summary cards of the chapter's finished lessons, in lesson order" }),
  })
  .meta({ id: "GoalChapter" });

export type ChapterView = z.infer<typeof chapterViewSchema>;
export type ChapterLessonView = ChapterView["lessons"][number];
