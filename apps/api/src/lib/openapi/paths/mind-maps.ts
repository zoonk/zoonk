import { chapterMindMapSchema, goalMindMapsSchema } from "@zoonk/core/mind-maps/contract";
import { z } from "zod";
import { mindMapGenerationSchema } from "../schemas/mind-maps";
import { goalChapterPathParamsSchema, goalPathParamsSchema } from "../schemas/paths";
import {
  forbiddenResponse,
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

/** A chapter's mind map, asking for one, and every map of a goal. */
export const mindMapPaths = {
  "/goals/{goalId}/chapters/{chapterId}/mind-map": {
    get: {
      description:
        "A chapter's mind map: its main concepts as an outline (a title, the central idea, 3 to 6 numbered branches with an explanation and points, an optional comparison and a summary line, in the chapter's language) and the picture drawn from it, square, with a small copy for lists. Maps are for chapters the learner finished, outside a language's units, and are shared by every learner of the chapter. A picture whose text failed its word-by-word check twice is left out: the outline is the map. A chapter outside the plan isn't found.",
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
        "Makes a chapter's mind map when the learner asks for it (never on a screen view). `ready` when it exists. Otherwise a run writes the map from what the chapter's lessons teach and draws it (about half a minute) and the answer is 202; a request while it's being made, from any learner of the chapter, joins that run. A new map counts once per chapter toward the learner's mind map limits (`resource: mindMap`; a map that exists is free), so a refusal is `SLOW_DOWN` or `USAGE_LIMIT_REACHED`.",
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
        "402": paymentRequiredResponse,
        "403": forbiddenResponse,
        "422": {
          ...unprocessableEntityResponse,
          description:
            "The learner hasn't finished the chapter, its lessons aren't written, or it's a language's unit",
        },
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Make a chapter's mind map",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/mind-maps": {
    get: {
      description:
        "A goal's mind maps: every chapter the learner finished, in plan order, with its subject (an exam's notice subject or the plan's module), its number and its map's status and picture (`image.thumbnailUrl` for grids). A chapter without one yet is `available` (POST `/goals/{goalId}/chapters/{chapterId}/mind-map/generations` makes it), `generating` or `failed`; the outline is on the chapter's map.",
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
