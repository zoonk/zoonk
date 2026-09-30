import { errorSchema } from "../schemas/common";
import {
  notFoundResponse,
  smallAiHelpRefusalResponses,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import {
  stepExampleLineSchema,
  stepPathParamsSchema,
  stepVariantRequestSchema,
  stepVariantSchema,
} from "../schemas/step-variants";
import { AUTHENTICATED_SECURITY } from "../security";

const variantUnavailableResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "No version could be written this time; try again later",
} as const;

export const stepVariantPaths = {
  "/me/example-lines/{stepId}": {
    post: {
      description:
        "The example line for the signed-in learner on one explanation screen: one sentence that ties its idea to their own life, built only from the facts they shared and their goal. It's written the first time (a POST, since writing it calls a model and counts as small AI help) and kept until those facts change.",
      operationId: "requestCurrentUserStepExampleLine",
      requestParams: { path: stepPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: stepExampleLineSchema } },
          description: "The learner's example line, or null",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        ...smallAiHelpRefusalResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get or write the learner's example line for a screen",
      tags: ["Lessons"],
    },
  },
  "/steps/{stepId}/variants": {
    post: {
      description:
        '"Simpler" or "Go deeper" for a lesson screen: returns the shared version, writing it the first time anyone asks. Every learner who asks for the same version gets the same one. Explanations and worked examples have both.',
      operationId: "requestStepVariant",
      requestBody: {
        content: { "application/json": { schema: stepVariantRequestSchema } },
        required: true,
      },
      requestParams: { path: stepPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: stepVariantSchema } },
          description: "The shared version of the screen",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
        ...smallAiHelpRefusalResponses,
        "503": variantUnavailableResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a simpler or deeper version of a screen",
      tags: ["Lessons"],
    },
  },
};
