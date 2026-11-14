import { type GoalKind } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

const mindMapBranchSchema = z
  .object({
    explanation: z.string().meta({ description: "What the concept is or why it matters" }),
    points: z.array(z.string()).meta({ description: "Up to three short bullets" }),
    title: z.string(),
  })
  .meta({ id: "MindMapBranch" });

const mindMapComparisonSchema = z
  .object({
    columns: z.array(z.object({ name: z.string(), points: z.array(z.string()) })),
    title: z.string(),
  })
  .meta({
    description: "A table comparing 2 to 5 things the chapter compares",
    id: "MindMapComparison",
  });

/** Text fallback must remain usable when the picture is missing, including for screen readers. */
const mindMapOutlineSchema = z
  .object({
    branches: z
      .array(mindMapBranchSchema)
      .meta({ description: "3 to 6 main concepts, in teaching order, numbered from 1" }),
    centralIdea: z.string(),
    comparison: mindMapComparisonSchema.nullable(),
    summary: z.string().meta({ description: "The chapter in one line" }),
    title: z.string().meta({ description: "The words in the middle of the map" }),
  })
  .meta({ id: "MindMapOutline" });

const mindMapImageSchema = z
  .object({
    height: z.int().min(1),
    thumbnailUrl: z.string().meta({ description: "A 640-pixel copy for lists of maps" }),
    url: z.string(),
    width: z.int().min(1),
  })
  .meta({ id: "MindMapImage" });

const mindMapStatusSchema = z
  .enum(["available", "writingLessons", "drawing", "ready", "failed", "unavailable"])
  .meta({
    description:
      "`available`: no map yet and nobody making it; `POST .../mind-map/generations` makes it, writing the chapter's `lessonsToWrite` lessons first. `writingLessons`: on its way, writing those lessons first (a few minutes); GET the status again. `drawing`: on its way, being written and drawn (about half a minute), also when the learner just finished the chapter and its map is owed; GET the status again. `ready`: `outline`, and `image` unless its picture failed its text check twice. The words on a picture are checked after it's shown, so a ready map's `image` may change once, to a redrawn picture, or go. `failed`: the last attempt failed; POST again. `unavailable`: no map for this chapter (a language's unit, or nothing in its outline to draw from)",
  });

/** The width a map's small picture is stored at, which a client names in the picture's `srcset`. */
export const MIND_MAP_THUMBNAIL_WIDTH = 640;

export const chapterMindMapStatusSchema = z
  .object({ status: mindMapStatusSchema })
  .meta({ id: "ChapterMindMapStatus" });

export const chapterMindMapSchema = z
  .object({
    chapterId: uuidSchema(),
    image: mindMapImageSchema
      .nullable()
      .meta({ description: "Null until it's drawn, and when its picture failed its check twice" }),
    lessonsToWrite: z
      .int()
      .min(0)
      .meta({
        description:
          "The chapter's lessons not written yet, which making its map writes first (each counts as a lesson start)",
      }),
    outline: mindMapOutlineSchema.nullable().meta({ description: "Null until it's `ready`" }),
    position: z
      .int()
      .min(1)
      .meta({
        description:
          "The chapter's number in its subject, as the subject's page lists it; in the plan when the goal's subjects have no pages",
      }),
    saved: z.boolean().meta({ description: "The learner saved this map to study again" }),
    status: mindMapStatusSchema,
    title: z.string().meta({ description: "The chapter's title" }),
  })
  .meta({ id: "ChapterMindMap" });

export type ChapterMindMapView = z.infer<typeof chapterMindMapSchema>;
export type MindMapImage = z.infer<typeof mindMapImageSchema>;
export type MindMapOutline = z.infer<typeof mindMapOutlineSchema>;
export type MindMapStatus = ChapterMindMapView["status"];

const goalMindMapSchema = chapterMindMapSchema
  .extend({
    status: mindMapStatusSchema
      .exclude(["unavailable"])
      .meta({
        description: "As a chapter's map, never `unavailable`: those chapters aren't listed",
      }),
    subject: z
      .object({
        key: z.string().meta({ description: "The subject's key in the goal's syllabus" }),
        name: z.string().meta({ description: "Its name, as its subject page titles it" }),
      })
      .nullable()
      .meta({
        description:
          "The subject or module the chapter teaches, when the goal's subjects have pages (an exam's notice, two or more modules)",
      }),
  })
  .meta({ id: "GoalMindMap" });

const savedMindMapKindSchema = z.enum(["chapter", "lesson"]).meta({ id: "SavedMindMapKind" });

const lessonMapGroupSchema = z
  .object({
    chapterId: uuidSchema(),
    count: z
      .int()
      .min(1)
      .meta({
        description:
          "The chapter's lessons with a written map, as `GET /goals/{goalId}/chapters/{chapterId}/lesson-maps` lists them, less any an earlier group already lists",
      }),
    lessonIds: z
      .array(uuidSchema())
      .meta({
        description:
          "The lessons whose maps open, in chapter order: the maps the Lessons tab studies, which a reader opened with this list keeps as they were",
      }),
  })
  .meta({ id: "LessonMapGroup" });

const savedMindMapSchema = z
  .object({
    available: z
      .boolean()
      .meta({
        description:
          "It opens now: a chapter map that's `ready`, or a lesson map in this goal's scope. False when it can no longer open here (its chapter left the plan, its content went); list those last, under no longer available, with a way to remove them",
      }),
    chapterId: uuidSchema()
      .nullable()
      .meta({
        description:
          "The chapter it opens in: the chapter itself, or for a lesson the first chapter of this goal's scope that holds it. Null when no chapter of the scope does",
      }),
    kind: savedMindMapKindSchema,
    targetId: uuidSchema().meta({ description: "The chapter's or the lesson's id" }),
    title: z
      .string()
      .meta({ description: "Its title now, or as it was when saved once it can no longer open" }),
  })
  .meta({ id: "SavedMindMap" });

const mindMapAllowanceStopSchema = z
  .object({
    period: z
      .enum(["day", "month", "total"])
      .nullable()
      .meta({
        description:
          "Which of the learner's limits ran out; null for `slowDown` and `signUpRequired`",
      }),
    reason: z
      .enum(["limitReached", "slowDown", "signUpRequired"])
      .meta({
        description:
          "`limitReached`: a mind map limit or the day's AI budget ran out. `slowDown`: try again after `resetsAt`. `signUpRequired`: a guest must create an account to make more",
      }),
    resetsAt: z.iso
      .datetime()
      .nullable()
      .meta({
        description:
          "When the allowance that stopped it comes back; null when it never does (`total`) or isn't known",
      }),
    resource: z
      .enum(["aiSpend", "mindMap"])
      .nullable()
      .meta({ description: "What ran out: the learner's mind maps, or the day's AI budget" }),
  })
  .meta({ id: "MindMapAllowanceStop" });

export type MindMapAllowanceStop = z.infer<typeof mindMapAllowanceStopSchema>;

const mindMapCreateOfferSchema = z
  .object({
    eligible: z
      .int()
      .min(0)
      .meta({
        description:
          "Chapters without a ready map or one on its way (failed ones included), whose lessons are all written: what `POST /goals/{goalId}/mind-maps/generations` makes",
      }),
    needLessons: z
      .int()
      .min(0)
      .meta({
        description:
          "Chapters without a map whose lessons aren't all written yet. Making them all at once doesn't write lessons: each chapter's own `POST .../mind-map/generations` writes them first",
      }),
    startable: z
      .int()
      .min(0)
      .meta({
        description:
          "How many of the `eligible` chapters one request would start now, in course order, within the learner's current allowance. A failed map the learner already claimed starts again for free, so it counts even when `stop` is set. 0 with `stop` set means nothing can start now",
      }),
    stop: mindMapAllowanceStopSchema
      .nullable()
      .meta({
        description:
          "What stops a new map now: one the learner hasn't claimed yet. Null while the allowance has room for one more; set once it hasn't, however many chapters are `eligible`, even while a failed map's free retry still counts in `startable`. A new map can start only while this is null, or when the chapter's map failed (the retry is free)",
      }),
  })
  .meta({ id: "MindMapCreateOffer" });

export type MindMapCreateOffer = z.infer<typeof mindMapCreateOfferSchema>;

export const goalMindMapsSchema = z
  .object({
    chapters: z
      .array(goalMindMapSchema)
      .meta({
        description:
          "Every chapter of the goal's scope that can have a map, in syllabus order: the plan's, and for a goal that follows a course every chapter of that course",
      }),
    createOffer: mindMapCreateOfferSchema,
    firstTab: z
      .enum(["chapters", "lessons"])
      .meta({
        description:
          "The tab to open first: `chapters` when a chapter map is `ready`, else `lessons` when a lesson map opens, else `chapters`",
      }),
    goal: z.object({ displayName: z.string(), id: uuidSchema(), title: z.string() }),
    lessonGroups: z
      .array(lessonMapGroupSchema)
      .meta({
        description:
          "Each listed chapter with lesson maps, in the order of `chapters`; chapters without any are left out. A lesson two chapters share is listed once, under the first",
      }),
    saved: z
      .array(savedMindMapSchema)
      .meta({
        description:
          "The Saved tab: every saved map of this goal's scope, then this goal's own saves that can no longer open (`available` false). Syllabus order: chapter maps and each chapter's lesson maps in chapter order, then the unavailable ones, newest save first",
      }),
  })
  .meta({ id: "GoalMindMaps" });

export type GoalMindMapsView = z.infer<typeof goalMindMapsSchema>;
export type GoalMindMapView = GoalMindMapsView["chapters"][number];
export type LessonMapGroup = z.infer<typeof lessonMapGroupSchema>;
export type SavedMindMapView = z.infer<typeof savedMindMapSchema>;

export const saveMindMapSchema = z
  .object({
    kind: savedMindMapKindSchema,
    saved: z.boolean().meta({ description: "True saves it, false removes it" }),
    targetId: uuidSchema().meta({ description: "The chapter's or the lesson's id" }),
  })
  .meta({ id: "SaveMindMap" });

export type SaveMindMapInput = z.infer<typeof saveMindMapSchema>;

export const savedMindMapStateSchema = saveMindMapSchema
  .extend({ saved: z.boolean().meta({ description: "Whether it's saved now" }) })
  .meta({ id: "SavedMindMapState" });

export const goalMindMapGenerationsSchema = z
  .object({
    accepted: z
      .array(uuidSchema())
      .meta({
        description:
          "Chapters whose maps this request started, in course order; each counted once toward the learner's mind maps",
      }),
    joined: z
      .array(uuidSchema())
      .meta({
        description:
          "Chapters whose maps were already ready or on their way, from any learner; nothing counted",
      }),
    stop: mindMapAllowanceStopSchema
      .nullable()
      .meta({ description: "Why `unstarted` chapters with reason `allowance` weren't started" }),
    unstarted: z
      .array(
        z.object({
          chapterId: uuidSchema(),
          reason: z
            .enum(["allowance", "needsLessons"])
            .meta({
              description:
                "`allowance`: the learner's allowance ran out first (`stop`). `needsLessons`: its lessons aren't all written; its own `POST .../mind-map/generations` writes them.",
            }),
        }),
      )
      .meta({ description: "Chapters without a ready map that this request didn't start" }),
  })
  .meta({ id: "GoalMindMapGenerations" });

export type GoalMindMapGenerations = z.infer<typeof goalMindMapGenerationsSchema>;

/** A goal whose plan is made of chapters has a Mind maps page from its first day. */
export function hasMindMapsPage(kind: GoalKind): boolean {
  return kind === "learn" || kind === "exam";
}
