import { CourseLevel, GoalKind, MasteryState } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { skillStateCountsSchema } from "../../learner/contract";
import { planCourseSchema } from "../../plans/plan-course-contract";

const countSchema = z.int().min(0);

const progressStateSchema = z.enum(["done", "current", "upcoming"]);

const phaseStateSchema = z
  .enum(["done", "unfinished", "current", "upcoming", "leftOut"])
  .meta({
    description:
      "The same state as the plan's phase (`GET /v1/goals/{goalId}/plan`). `current` is the earliest phase with work left, and none is once nothing of the plan is left; one before it is `done` once the learner finished its work, `unfinished` while some of it was set aside (missed days the plan couldn't fit back): never mark it done. `leftOut`: the plan holds none of its work (a date too near for its topics): say it's not in the plan, and leave it out of the phases counted done",
  });

export const mapSkillSchema = z
  .object({
    description: z.string().nullable().meta({ description: "The idea in one sentence" }),
    fading: z.boolean().meta({ description: "Its chance of recall dropped: a review relights it" }),
    name: z.string(),
    prerequisiteIds: z
      .array(uuidSchema())
      .meta({ description: "Skills of the goal learned before this one: the map's links" }),
    retrievability: z
      .number()
      .min(0)
      .max(1)
      .nullable()
      .meta({ description: "The chance of recalling it now; null when never studied" }),
    skillId: uuidSchema(),
    state: z.enum(MasteryState),
  })
  .meta({ id: "MapSkill" });

const mapAreaSchema = z
  .object({
    areaId: z
      .string()
      .meta({ description: "The chapter's id, or `phase:N` for skills not in a chapter yet" }),
    chapterId: uuidSchema()
      .nullable()
      .meta({ description: "Null before the skills have a chapter" }),
    counts: skillStateCountsSchema,
    courseId: uuidSchema().nullable().meta({ description: "The course the chapter belongs to" }),
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
    state: phaseStateSchema,
  })
  .meta({ id: "MapPhase" });

const courseLinkSchema = z.object({
  brandSlug: z.string().meta({ description: "With `courseSlug`, the course's public page" }),
  courseId: uuidSchema(),
  courseSlug: z.string(),
  title: z.string(),
});

const studyNextSchema = z
  .object({
    nextLevel: z
      .object({
        chapterCount: countSchema.meta({ description: "Chapters outlined at that level so far" }),
        courseId: uuidSchema(),
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
    certificates: z
      .object({
        earned: z
          .array(
            z.object({
              code: z.string(),
              courseLevel: z.enum(CourseLevel).nullable(),
              locked: z
                .boolean()
                .meta({ description: "Earned without Plus: show it with the Plus mark" }),
            }),
          )
          .meta({
            description:
              "The certificates of this plan's levels and of the plan itself the learner holds, in level order with the plan's last; a level they certified in another goal too",
          }),
        unclaimed: z
          .array(
            z.object({
              cefrRange: z
                .string()
                .nullable()
                .meta({
                  description:
                    "A language course's level: the CEFR levels it covers, such as \"B1–B2\", shown with the level's name. Null otherwise",
                }),
              courseLevel: z.enum(CourseLevel).nullable(),
            }),
          )
          .meta({
            description:
              "Finished levels, or the finished plan (`courseLevel` null), without a certificate yet: offer them with POST /v1/goals/{goalId}/certificates",
          }),
      })
      .nullable()
      .meta({
        description:
          "A learn, exam or language goal's certificates: one per level of a Library course it finishes whole with at least half its lessons studied, and one for the plan when it finishes so with lessons no certified level covers. Null until one is finished or held, and for explain goals",
        id: "PlanCertificates",
      }),
    counts: skillStateCountsSchema,
    course: planCourseSchema.nullable(),
    courses: z
      .array(z.object({ courseId: uuidSchema(), title: z.string() }))
      .meta({ description: "The courses the chapters come from, for the map's course view" }),
    goal: z.object({ id: uuidSchema(), kind: z.enum(GoalKind), title: z.string() }),
    next: studyNextSchema
      .nullable()
      .meta({
        description:
          "What to study next, once the plan is finished: every lesson studied or tested out and every phase's challenge won (the plan's `end` is `finished`). Null before",
      }),
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
              skillId: uuidSchema(),
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
