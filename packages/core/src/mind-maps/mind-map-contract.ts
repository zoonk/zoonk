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

/**
 * A mind map as text, in the chapter's language: what the picture letters, for screen readers,
 * search and when the picture is missing.
 */
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
  .enum(["unavailable", "available", "generating", "ready", "failed"])
  .meta({
    description:
      "`unavailable`: maps are for chapters the learner finished (and not a language's units). `available`: finished and without a map yet; `POST .../mind-map/generations` makes it. `generating`: being written and drawn (about half a minute); GET again. `ready`: `outline`, and `image` unless its picture failed its text check twice. The words on a picture are checked after it's shown, so a ready map's `image` may change once, to a redrawn picture, or go. `failed`: the last attempt failed; POST again",
  });

/** One chapter's mind map as a goal's learner sees it. */
export const chapterMindMapSchema = z
  .object({
    chapterId: z.uuid(),
    image: mindMapImageSchema
      .nullable()
      .meta({ description: "Null until it's drawn, and when its picture failed its check twice" }),
    outline: mindMapOutlineSchema.nullable().meta({ description: "Null until it's `ready`" }),
    position: z
      .int()
      .min(1)
      .meta({
        description:
          "The chapter's number in its subject, as the subject's page lists it; in the plan when the goal's subjects have no pages",
      }),
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
    status: z.enum(["available", "generating", "ready", "failed"]),
    subject: z
      .object({
        key: z.string().meta({ description: "The subject's key in the goal's syllabus" }),
        name: z.string().meta({ description: "Its short name" }),
      })
      .nullable()
      .meta({
        description:
          "The subject or module the chapter teaches, when the goal's subjects have pages (an exam's notice, two or more modules)",
      }),
  })
  .meta({ id: "GoalMindMap" });

/** Every chapter of a goal the learner finished, with its map or the way to make it. */
export const goalMindMapsSchema = z
  .object({
    chapters: z
      .array(goalMindMapSchema)
      .meta({ description: "The chapters the learner finished, in plan order" }),
    goal: z.object({ id: z.uuid(), title: z.string() }),
  })
  .meta({ id: "GoalMindMaps" });

export type GoalMindMapsView = z.infer<typeof goalMindMapsSchema>;
export type GoalMindMapView = GoalMindMapsView["chapters"][number];
