import {
  notFoundResponse,
  smallAiHelpRefusalResponses,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { stepExampleLineSchema, stepPathParamsSchema } from "../schemas/steps";
import { AUTHENTICATED_SECURITY } from "../security";

export const exampleLinePaths = {
  "/me/example-lines/{stepId}": {
    get: {
      description:
        "Reads the signed-in learner's saved example matching their current facts and goal, and whether asking for one (POST) can write it. The line is null when none is saved. Never starts AI work, consumes help, or changes memory.",
      operationId: "getCurrentUserStepExampleLine",
      requestParams: { path: stepPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: stepExampleLineSchema } },
          description: "The learner's saved example line, or null",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Read the learner's saved example line for a screen",
      tags: ["Lessons"],
    },
    post: {
      description:
        "The example line for the signed-in learner on one explanation screen: one sentence that ties its idea to their own life, built only from the facts they shared and their goal. It's written the first time (a POST, since writing it calls a model and counts as small AI help) and kept until those facts change. The lines of a lesson's screens are written together, so each tells a different moment: null when the screen leaves no room for one, and when nothing they shared fits in a moment the lesson's other lines and their recent lines didn't already use.",
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
      summary: "Request the learner's example line for a screen",
      tags: ["Lessons"],
    },
  },
};
