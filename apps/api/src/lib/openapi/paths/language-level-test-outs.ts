import { startLanguageLevelTestOutInputSchema } from "@zoonk/core/language/level-test/contract";
import {
  levelTestOutAnswerSchema,
  levelTestOutFinishSchema,
} from "@zoonk/core/language/level-test/test-out-contract";
import { languageLevelTestOutViewSchema } from "../schemas/language";
import { goalPathParamsSchema } from "../schemas/paths";
import {
  jsonResponse,
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const readErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
  "422": unprocessableEntityResponse,
};

const common = { security: AUTHENTICATED_SECURITY, tags: ["Language"] };
const testOutPath = "/goals/{goalId}/language-level-test/test-outs";

export const languageLevelTestOutPaths = {
  [testOutPath]: {
    get: {
      ...common,
      operationId: "getLanguageLevelTestOut",
      requestParams: { path: goalPathParamsSchema, query: levelTestOutFinishSchema },
      responses: {
        "200": jsonResponse(languageLevelTestOutViewSchema, "The saved test-out"),
        ...readErrors,
      },
      summary: "Get the language level test-out",
    },
    post: {
      ...common,
      operationId: "startLanguageLevelTestOut",
      requestBody: {
        content: { "application/json": { schema: startLanguageLevelTestOutInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(languageLevelTestOutViewSchema, "The open test-out"),
        ...readErrors,
      },
      summary: "Open a language level test-out",
    },
  },
  [`${testOutPath}/answers`]: {
    post: {
      ...common,
      operationId: "answerLanguageLevelTestOut",
      requestBody: {
        content: { "application/json": { schema: levelTestOutAnswerSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(languageLevelTestOutViewSchema, "What comes next"),
        ...readErrors,
      },
      summary: "Answer a language level test-out question",
    },
  },
  [`${testOutPath}/completions`]: {
    post: {
      ...common,
      operationId: "finishLanguageLevelTestOut",
      requestBody: {
        content: { "application/json": { schema: levelTestOutFinishSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": jsonResponse(languageLevelTestOutViewSchema, "The finished test-out"),
        ...readErrors,
      },
      summary: "Finish a language level test-out",
    },
  },
};
