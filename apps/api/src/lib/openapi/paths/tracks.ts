import {
  badRequestResponse,
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
} from "../schemas/responses";
import {
  startTrackResponseSchema,
  trackCreateRequestSchema,
  trackListQuerySchema,
  trackListResponseSchema,
  trackPathParamsSchema,
  trackResponseSchema,
  trackUpdateRequestSchema,
} from "../schemas/tracks";
import { AUTHENTICATED_SECURITY } from "../security";

export const trackPaths = {
  "/me/tracks": {
    get: {
      operationId: "listCurrentUserTracks",
      requestParams: { query: trackListQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: trackListResponseSchema } },
          description: "Paginated tracks owned by the current learner",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List current user's learning tracks",
      tags: ["Tracks"],
    },
    post: {
      operationId: "createCurrentUserTrack",
      requestBody: {
        content: { "application/json": { schema: trackCreateRequestSchema } },
        required: true,
      },
      responses: {
        "201": {
          content: { "application/json": { schema: trackResponseSchema } },
          description: "Track created with courses in the supplied order",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "409": conflictResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Create a learning track",
      tags: ["Tracks"],
    },
  },
  "/me/tracks/{trackId}": {
    delete: {
      operationId: "removeCurrentUserTrack",
      requestParams: { path: trackPathParamsSchema },
      responses: {
        "204": { description: "Track removed; courses, enrollment and learning history retained" },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "409": conflictResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Remove a learning track",
      tags: ["Tracks"],
    },
    get: {
      operationId: "getCurrentUserTrack",
      requestParams: { path: trackPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: trackResponseSchema } },
          description: "Track and selected learning progress owned by the current learner",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a learning track",
      tags: ["Tracks"],
    },
    patch: {
      operationId: "updateCurrentUserTrack",
      requestBody: {
        content: { "application/json": { schema: trackUpdateRequestSchema } },
        required: true,
      },
      requestParams: { path: trackPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: trackResponseSchema } },
          description: "Updated title or ordered course membership, preserving learning history",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "409": conflictResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Update a learning track",
      tags: ["Tracks"],
    },
  },
  "/me/tracks/{trackId}/start": {
    post: {
      operationId: "startCurrentUserTrack",
      requestParams: { path: trackPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: startTrackResponseSchema } },
          description:
            "Next selected learning step, completed Track, or explicit generation target. Start again after generation to continue the ordered Track.",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": conflictResponse,
        "422": unprocessableEntityResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start or resume a learning track",
      tags: ["Tracks"],
    },
  },
};
