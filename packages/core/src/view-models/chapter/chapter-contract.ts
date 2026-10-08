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
    written: z
      .boolean()
      .meta({
        description:
          "Its screens are written, so opening it starts no writing and apps may load it ahead",
      }),
  })
  .meta({ id: "ChapterLesson" });

/**
 * A chapter of the learner's plan: its map (the chapter's
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
        .meta({
          description:
            "Its number in `subject`, as the subject's page lists it (`SyllabusChapter.position`); its number in the plan when `subject` is null",
        }),
      state: z.enum(["done", "current", "upcoming"]),
      subject: z
        .object({
          key: z.string().meta({ description: "The subject's key in the goal's syllabus" }),
          name: z.string().meta({ description: "Its short name" }),
        })
        .nullable()
        .meta({
          description:
            "The subject or module whose page numbers it (Biologia · Chapter 4); null when the goal's subjects have no pages (a plan from one course, a language) or none lists it",
        }),
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
