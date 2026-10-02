import {
  memoryFactUpdateSchema,
  memoryInsightAnswerSchema,
  memoryInsightQuerySchema,
  memorySettingsUpdateSchema,
  memoryUndoInputSchema,
} from "@zoonk/core/memory/contract";
import { memoryErrorCodes } from "../../memory-error-codes";
import {
  currentMemoryInsightResponseSchema,
  memoryChangeReversalSchema,
  memoryExportSchema,
  memoryFactDeletionSchema,
  memoryFactResponseSchema,
  memoryInsightResultSchema,
  memoryResponseSchema,
  memorySettingsResponseSchema,
} from "../schemas/memory";
import { memoryFactPathParamsSchema, memoryInsightPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const memoryPaths = {
  "/me/memory": {
    get: {
      description:
        "Every active fact Zoonk remembers about the learner, newest first, grouped by the categories their memory may hold (only goals and learning for minors), with the memory switch.",
      operationId: "getCurrentUserMemory",
      responses: {
        "200": {
          content: { "application/json": { schema: memoryResponseSchema } },
          description: "The learner's memory",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get the current learner's memory",
      tags: ["Memory"],
    },
    patch: {
      description:
        "Turns memory off or on. Off, Zoonk learns no new facts and no task reads them; the facts stay listed.",
      operationId: "updateCurrentUserMemorySettings",
      requestBody: {
        content: { "application/json": { schema: memorySettingsUpdateSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: memorySettingsResponseSchema } },
          description: "The memory switch",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Turn the current learner's memory on or off",
      tags: ["Memory"],
    },
  },
  "/me/memory/change-reversals": {
    post: {
      description:
        'Undoes the changes a "Memory updated" notice or a deletion returned: an added fact is taken back, a replaced fact returns in place of the new one, and a deleted fact returns with the facts it had replaced. All changes are undone or none are.',
      operationId: "createMemoryChangeReversal",
      requestBody: {
        content: { "application/json": { schema: memoryUndoInputSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: memoryChangeReversalSchema } },
          description: "What the undo took back and brought back",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "409": {
          ...conflictResponse,
          description: `A change was already undone or has changed since. Error code: ${memoryErrorCodes.changeAlreadyUndone}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Undo memory changes",
      tags: ["Memory"],
    },
  },
  "/me/memory/export": {
    get: {
      description:
        "Everything in the learner's memory for an export with their account data: every fact with its status and history, including deleted facts not yet purged (after 30 days), and every insight shown.",
      operationId: "exportCurrentUserMemory",
      responses: {
        "200": {
          content: { "application/json": { schema: memoryExportSchema } },
          description: "The learner's memory export",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Export the current learner's memory",
      tags: ["Memory"],
    },
  },
  "/me/memory/facts/{factId}": {
    delete: {
      description:
        "Deletes a fact together with the facts it replaced. Zoonk stops using it right away, and the returned change can be undone for 30 days.",
      operationId: "deleteMemoryFact",
      requestParams: { path: memoryFactPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: memoryFactDeletionSchema } },
          description: "The deletion, as a change that can be undone",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Delete a memory fact",
      tags: ["Memory"],
    },
    patch: {
      description:
        "Saves the learner's correction of a fact in place; the old wording isn't kept. The fact then counts as something the learner said.",
      operationId: "updateMemoryFact",
      requestBody: {
        content: { "application/json": { schema: memoryFactUpdateSchema } },
        required: true,
      },
      requestParams: { path: memoryFactPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: memoryFactResponseSchema } },
          description: "The corrected fact",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "422": {
          ...unprocessableEntityResponse,
          description: `A minor's memory can only hold goals and learning facts. Error code: ${memoryErrorCodes.categoryNotAllowed}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Correct a memory fact",
      tags: ["Memory"],
    },
  },
  "/me/memory/insights/current": {
    get: {
      description:
        'The insight Today shows after a session ("From your recent answers"): a tip, a plan change offer or a schedule idea, until the learner answers it. At most one a day; null when there is none.',
      operationId: "getCurrentMemoryInsight",
      requestParams: { query: memoryInsightQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: currentMemoryInsightResponseSchema } },
          description: "The current insight, or null",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get the current memory insight",
      tags: ["Memory"],
    },
  },
  "/me/memory/insights/{insightId}": {
    patch: {
      description:
        "Accepts or dismisses an insight. Accepting a schedule idea moves the goal's study time to the suggested one.",
      operationId: "answerMemoryInsight",
      requestBody: {
        content: { "application/json": { schema: memoryInsightAnswerSchema } },
        required: true,
      },
      requestParams: { path: memoryInsightPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: memoryInsightResultSchema } },
          description: "The answered insight",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": {
          ...conflictResponse,
          description: `The insight was already answered. Error code: ${memoryErrorCodes.insightAlreadyAnswered}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Answer a memory insight",
      tags: ["Memory"],
    },
  },
};
