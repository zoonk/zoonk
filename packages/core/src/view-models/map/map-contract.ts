import { CourseLevel, GoalKind, MasteryState } from "@zoonk/db";
import { z } from "zod";
import { skillStateCountsSchema } from "../../learner/contract";
import { planCourseSchema } from "../../plans/plan-course-contract";

const countSchema = z.int().min(0);

const progressStateSchema = z.enum(["done", "current", "upcoming"]);

export const mapSkillSchema = z
  .object({
    description: z.string().nullable().meta({ description: "The idea in one sentence" }),
    fading: z.boolean().meta({ description: "Its chance of recall dropped: a review relights it" }),
    name: z.string(),
    prerequisiteIds: z
      .array(z.uuid())
      .meta({ description: "Skills of the goal learned before this one: the map's links" }),
    retrievability: z
      .number()
      .min(0)
      .max(1)
      .nullable()
      .meta({ description: "The chance of recalling it now; null when never studied" }),
    skillId: z.uuid(),
    state: z.enum(MasteryState),
  })
  .meta({ id: "MapSkill" });

const mapAreaSchema = z
  .object({
    areaId: z
      .string()
      .meta({ description: "The chapter's id, or `phase:N` for skills not in a chapter yet" }),
    chapterId: z.uuid().nullable().meta({ description: "Null before the skills have a chapter" }),
    counts: skillStateCountsSchema,
    courseId: z.uuid().nullable().meta({ description: "The course the chapter belongs to" }),
    current: z.boolean().meta({ description: "The learner is here: the plan's next lesson" }),
    phase: z.int().min(0),
    skills: z.array(mapSkillSchema),
    state: progressStateSchema,
    title: z.string(),
  })
  .meta({ id: "MapArea" });

const mapPhaseSchema = z
  .object({
    counts: skillStateCountsSchema,
    index: z.int().min(0),
    name: z.string().meta({ description: "Empty for exam phases, which apps name by kind" }),
    state: progressStateSchema,
  })
  .meta({ id: "MapPhase" });

const courseLinkSchema = z.object({
  brandSlug: z.string().meta({ description: "With `courseSlug`, the course's public page" }),
  courseId: z.uuid(),
  courseSlug: z.string(),
  title: z.string(),
});

const studyNextSchema = z
  .object({
    nextLevel: z
      .object({
        chapterCount: countSchema.meta({ description: "Chapters outlined at that level so far" }),
        courseId: z.uuid(),
        level: z.enum(CourseLevel),
        title: z.string(),
      })
      .nullable()
      .meta({
        description:
          "The next level of the plan's course, which `POST /v1/goals/{goalId}/next-level` starts; null at the top",
      }),
    related: z
      .array(courseLinkSchema)
      .meta({ description: "Other public courses the plan drew from, to explore next" }),
  })
  .meta({ id: "StudyNext" });

export const fieldMapViewSchema = z
  .object({
    areas: z
      .array(mapAreaSchema)
      .meta({ description: "Every chapter of the plan with its skills, in plan order" }),
    counts: skillStateCountsSchema,
    course: planCourseSchema.nullable(),
    courses: z
      .array(z.object({ courseId: z.uuid(), title: z.string() }))
      .meta({ description: "The courses the chapters come from, for the map's course view" }),
    goal: z.object({ id: z.uuid(), kind: z.enum(GoalKind), title: z.string() }),
    next: studyNextSchema
      .nullable()
      .meta({ description: "What to study next, once every lesson of the plan is done" }),
    phases: z.array(mapPhaseSchema),
    refresh: z
      .object({
        emphasized: z
          .boolean()
          .meta({ description: "The goal is to refresh what the learner knew: lead with this" }),
        skills: z
          .array(
            z.object({
              name: z.string(),
              retrievability: z.number().min(0).max(1).nullable(),
              skillId: z.uuid(),
            }),
          )
          .meta({ description: "Skills fading now, most faded first" }),
      })
      .meta({ description: "Refresh mode: what's fading, which `refresh-practice` brings back" }),
  })
  .meta({ id: "FieldMap" });

export type MapSkill = z.infer<typeof mapSkillSchema>;
export type FieldMapView = z.infer<typeof fieldMapViewSchema>;
export type MapArea = FieldMapView["areas"][number];
export type MapPhase = FieldMapView["phases"][number];
export type StudyNextView = z.infer<typeof studyNextSchema>;
