import {
  chapterMindMapSchema,
  chapterMindMapStatusSchema,
  goalMindMapsSchema,
} from "@zoonk/core/mind-maps/contract";
import { z } from "zod";
import { mindMapGenerationSchema } from "../schemas/mind-maps";
import { goalChapterPathParamsSchema, goalPathParamsSchema } from "../schemas/paths";
import {
  guestRefusalResponse,
  notFoundResponse,
  paymentRequiredResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const readErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
} as const;

export const mindMapPaths = {
  "/goals/{goalId}/chapters/{chapterId}/mind-map": {
    get: {
      description:
        "A chapter's mind map: its main concepts as an outline (a title, the central idea, 3 to 6 numbered branches with an explanation and points, an optional comparison and a summary line, in the chapter's language) and the picture drawn from it, square, with a small copy for lists, with the map's status for its row. Any chapter of the plan can have one, finished or not, outside a language's units; maps are shared by every learner of the chapter. A picture whose text failed its word-by-word check twice is left out: the outline is the map. A chapter outside the plan isn't found.",
      operationId: "getChapterMindMap",
      requestParams: { path: goalChapterPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: chapterMindMapSchema } },
          description: "The chapter's mind map",
        },
        ...readErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a chapter's mind map",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/chapters/{chapterId}/mind-map/generations": {
    post: {
      description:
        "Makes a chapter's mind map when the learner asks for it (never on a screen view). `ready` when it exists. Otherwise a run writes the chapter's lessons not written yet (`writingLessons`, a few minutes), then writes the map from what they teach and draws it (`drawing`, about half a minute), and the answer is 202; a request while it's being made, from any learner of the chapter, joins that run and counts nothing. Before a run starts, a new map counts once per chapter toward the learner's mind map limits (`resource: mindMap`) and each lesson it writes first counts as that lesson's start (starting it later counts nothing more), all or none; a refusal is `SLOW_DOWN` or `USAGE_LIMIT_REACHED` with `details.limit` (its `resource` says what ran out). A chapter whose lessons a free exam plan past its first week keeps for Plus answers 402 `PLUS_REQUIRED` and nothing is made.",
      operationId: "createChapterMindMapGeneration",
      requestParams: { path: goalChapterPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mindMapGenerationSchema } },
          description: "The chapter has its map",
        },
        "202": {
          content: { "application/json": { schema: mindMapGenerationSchema } },
          description: "A run is making the map",
          headers: z.object({
            Location: z
              .string()
              .optional()
              .meta({
                description:
                  "The run's status URL, once it has one: GET /generations/{generationId}",
              }),
          }),
        },
        ...readErrors,
        "402": {
          ...paymentRequiredResponse,
          description:
            "The free plan's mind maps or lessons are used up (`USAGE_LIMIT_REACHED`; Plus has more), or a free exam plan past its first week keeps this chapter's lessons, and so its map, for Plus (`PLUS_REQUIRED`)",
        },
        "403": guestRefusalResponse,
        "422": {
          ...unprocessableEntityResponse,
          description:
            "The chapter has no mind map: it's a language's unit, or its outline has nothing to draw from",
        },
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Make a chapter's mind map",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/chapters/{chapterId}/mind-map/status": {
    get: {
      description:
        "The live status of a chapter's mind map, for a row that waits on it: `writingLessons` or `drawing` while it's on its way, including right after the learner finished the chapter and before its run starts. Checks the same ownership and chapter visibility as the full map read. Never starts generation or returns the outline and picture.",
      operationId: "getChapterMindMapStatus",
      requestParams: { path: goalChapterPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: chapterMindMapStatusSchema } },
          description: "The map's live status",
        },
        ...readErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Read a chapter's mind map status",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/mind-maps": {
    get: {
      description:
        "A goal's mind maps: every chapter of the plan that can have one, finished or not, in plan order, with its subject (an exam's notice subject or the plan's module) to group by, its number, and its map's status, picture (`image.thumbnailUrl` for lists) and outline. A chapter without one yet is `available` (POST `/goals/{goalId}/chapters/{chapterId}/mind-map/generations` makes it), `writingLessons`, `drawing`, `failed` or `plusRequired`. Topics without a chapter yet and a language's units aren't listed.",
      operationId: "listGoalMindMaps",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: goalMindMapsSchema } },
          description: "The goal's mind maps",
        },
        ...readErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List a goal's mind maps",
      tags: ["Learner"],
    },
  },
};
