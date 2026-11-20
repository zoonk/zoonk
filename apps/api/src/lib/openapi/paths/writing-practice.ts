import {
  saveWritingDraftSchema,
  writingBlockInputSchema,
  writingDraftSchema,
  writingStartInputSchema,
  writingStartSchema,
} from "@zoonk/core/exams/essays/writing-contract";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { essayPathParamsSchema, goalPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const tags = ["Exams"];

const errors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
};

export const writingPracticePaths = {
  "/essays/{blockId}/draft": {
    put: {
      operationId: "saveWritingDraft",
      requestBody: {
        content: { "application/json": { schema: saveWritingDraftSchema } },
        required: true,
      },
      requestParams: { path: essayPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: writingDraftSchema } },
          description: "The saved draft and its new revision",
        },
        "409": {
          content: {
            "application/json": {
              schema: z.union([
                writingDraftSchema,
                conflictResponse.content["application/json"].schema,
              ]),
            },
          },
          description:
            "The current draft on a revision conflict, or an error if the answer was already submitted",
        },
        ...errors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Save a writing draft",
      tags,
    },
  },
  "/essays/{blockId}/starts": {
    post: {
      operationId: "startWriting",
      requestBody: {
        content: { "application/json": { schema: writingStartInputSchema } },
        required: true,
      },
      requestParams: { path: essayPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: writingStartSchema } },
          description: "The admission for this answer",
        },
        "202": {
          content: { "application/json": { schema: writingStartSchema } },
          description: "The requested prompt is being written",
        },
        "403": forbiddenResponse,
        "409": conflictResponse,
        "429": {
          content: { "application/json": { schema: writingStartSchema } },
          description: "The day this extra writing allowance returns",
        },
        ...errors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start or resume a writing block",
      tags,
    },
  },
  "/goals/{goalId}/writing-blocks": {
    post: {
      operationId: "createWritingBlock",
      requestBody: {
        content: { "application/json": { schema: writingBlockInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: z.object({ blockId: uuidSchema() }) } },
          description: "The unfinished block for the requested writing task",
        },
        "409": conflictResponse,
        ...errors,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get or create an extra writing block",
      tags,
    },
  },
};
