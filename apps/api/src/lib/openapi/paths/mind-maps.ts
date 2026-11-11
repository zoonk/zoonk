import {
  chapterMindMapSchema,
  chapterMindMapStatusSchema,
  goalMindMapGenerationsSchema,
  goalMindMapsSchema,
  saveMindMapSchema,
  savedMindMapStateSchema,
} from "@zoonk/core/mind-maps/contract";
import { chapterLessonMapsSchema } from "@zoonk/core/mind-maps/lesson-maps-contract";
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
  "/goals/{goalId}/chapters/{chapterId}/lesson-maps": {
    get: {
      description:
        "A chapter's lesson maps: every lesson of the chapter whose map is written and published, studied or not, in chapter order, with its ideas and their icons as the lesson player draws them, whether the learner saved it, and whether a free exam plan past its first week keeps it for Plus (`locked`, with no `map`). Maps written before ideas had labels are included. Lesson maps are shared content; a lesson's map appears once the lesson is written. A chapter outside the goal's scope, or one that can't have maps (a language's unit), isn't found.",
      operationId: "listChapterLessonMaps",
      requestParams: { path: goalChapterPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: chapterLessonMapsSchema } },
          description: "The chapter's lesson maps",
        },
        ...readErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List a chapter's lesson maps",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/chapters/{chapterId}/mind-map": {
    get: {
      description:
        "A chapter's mind map: its main concepts as an outline (a title, the central idea, 3 to 6 numbered branches with an explanation and points, an optional comparison and a summary line, in the chapter's language) and the picture drawn from it, square, with a small copy for lists, with the map's status for its row. Any chapter of the goal's scope can have one, finished or not, outside a language's units: the plan's chapters, and for a goal that follows a course every chapter of that course. Maps are shared by every learner of the chapter. A picture whose text failed its word-by-word check twice is left out: the outline is the map. `saved` says whether the learner saved it. A chapter outside the scope isn't found.",
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
        "Makes a chapter's mind map when the learner asks for it (never on a screen view); any chapter of the goal's scope, as `GET /goals/{goalId}/mind-maps` lists them. `ready` when it exists. Otherwise a run writes the chapter's lessons not written yet (`writingLessons`, a few minutes), then writes the map from what they teach and draws it (`drawing`, about half a minute), and the answer is 202; a request while it's being made, from any learner of the chapter, joins that run and counts nothing. Before a run starts, a new map counts once per chapter toward the learner's mind map limits (`resource: mindMap`) and each lesson it writes first counts as that lesson's start (starting it later counts nothing more), all or none; a refusal is `SLOW_DOWN` or `USAGE_LIMIT_REACHED` with `details.limit` (its `resource` says what ran out). A chapter whose lessons a free exam plan past its first week keeps for Plus answers 402 `PLUS_REQUIRED` and nothing is made.",
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
        "A goal's Mind maps page. `chapters`: every chapter of the goal's scope that can have a map, finished or not (the plan's, and for a goal that follows a course every chapter of that course), in syllabus order, with its subject (an exam's notice subject or the plan's module) to group by, its number, whether the learner saved it, and its map's status, picture (`image.thumbnailUrl` for lists) and outline, so the chapter maps open with no further request. A chapter without one yet is `available` (POST `/goals/{goalId}/chapters/{chapterId}/mind-map/generations` makes it), `writingLessons`, `drawing`, `failed` or `plusRequired`. Topics without a chapter yet and a language's units aren't listed. `lessonGroups`: each chapter's lesson maps, how many and which open (`GET /goals/{goalId}/chapters/{chapterId}/lesson-maps` reads them). `saved`: the Saved tab. `createOffer`: what `POST /goals/{goalId}/mind-maps/generations` would start now. `firstTab`: the tab to open first. While a map is `drawing` GET this again every 5 seconds, and every 15 while one is only `writingLessons`.",
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
  "/goals/{goalId}/mind-maps/generations": {
    post: {
      description:
        "Create all chapter maps, when the learner asks for it (never on a screen view). Starts the map of every chapter of the goal's scope that has no map ready or on its way (failed ones included), whose lessons are all written and that isn't `plusRequired`, in course order, as far as the learner's allowance goes; it never writes lessons, so a chapter that still needs them waits for its own `POST .../mind-map/generations`. Each new map counts once toward the learner's mind maps (`resource: mindMap`); a map they claimed before, such as a failed one, counts nothing again, and a map another learner is making is joined free. When the allowance runs out partway, the chapters before it still start and the rest are `unstarted` with reason `allowance` and `stop` says why; nothing is refused as a whole. Always 202: follow progress with `GET /goals/{goalId}/mind-maps`. Sending it again starts only what's still missing.",
      operationId: "createGoalMindMapGenerations",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "202": {
          content: { "application/json": { schema: goalMindMapGenerationsSchema } },
          description: "What the request started, joined and left",
        },
        ...readErrors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Make all of a goal's chapter maps",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/mind-maps/saved": {
    post: {
      description:
        "Saves a map to study again (`saved: true`) or removes it (`saved: false`). It's the state the learner wants, so sending it again changes nothing. Saving needs a map the learner can open now in this goal's scope: a `ready` chapter map, or a lesson map from `GET .../lesson-maps` that isn't locked; otherwise 404, or 402 `PLUS_REQUIRED` for a locked one. Removing needs only the learner's own save, from any goal. Saves belong to the learner's account and are free on every plan; a save never opens a map the learner couldn't open.",
      operationId: "saveMindMap",
      requestBody: {
        content: { "application/json": { schema: saveMindMapSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: savedMindMapStateSchema } },
          description: "The map's saved state now",
        },
        ...readErrors,
        "402": {
          ...paymentRequiredResponse,
          description:
            "A free exam plan past its first week keeps this map for Plus (`PLUS_REQUIRED`)",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Save or remove a map",
      tags: ["Learner"],
    },
  },
};
