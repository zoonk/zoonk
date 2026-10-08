import {
  type CreateDocumentOptions,
  type ZodOpenApiOperationObject,
  type ZodOpenApiPathItemObject,
  type ZodOpenApiPathsObject,
  type ZodOpenApiVersion,
  createDocument,
} from "zod-openapi";
import { accountPaths } from "./paths/account";
import { catalogPaths } from "./paths/catalog";
import { catalogResourcePaths } from "./paths/catalog-resources";
import { checkpointPaths } from "./paths/checkpoints";
import { contentGenerationPaths } from "./paths/content-generation";
import { courseGoalPaths } from "./paths/course-goals";
import { currentLearningPaths } from "./paths/current-learning";
import { currentUserProgressPaths } from "./paths/current-user-progress";
import { exampleLinePaths } from "./paths/example-lines";
import { examPaths } from "./paths/exams";
import { feedbackPaths } from "./paths/feedback";
import { filePaths } from "./paths/files";
import { generationPaths } from "./paths/generations";
import { goalMapPaths } from "./paths/goal-maps";
import { goalPaths } from "./paths/goals";
import { guardianPaths } from "./paths/guardians";
import { guestPaths } from "./paths/guests";
import { instrumentWaitlistPaths } from "./paths/instrument-waitlist";
import { languagePaths } from "./paths/language";
import { languageConversationPaths } from "./paths/language-conversations";
import { languageGoalPaths } from "./paths/language-goal";
import { learnViewPaths } from "./paths/learn-views";
import { learnerPaths } from "./paths/learner";
import { learnerProfilePaths } from "./paths/learner-profile";
import { lessonQuestionPaths } from "./paths/lesson-questions";
import { lessonRegenerationPaths } from "./paths/lesson-regenerations";
import { libraryLessonPaths } from "./paths/library-lessons";
import { memoryPaths } from "./paths/memory";
import { milestonePaths } from "./paths/milestones";
import { mindMapPaths } from "./paths/mind-maps";
import { mistakePaths } from "./paths/mistakes";
import { mockPaths } from "./paths/mocks";
import { onboardingPaths } from "./paths/onboarding";
import { placementPaths } from "./paths/placement";
import { planPaths } from "./paths/plans";
import { progressPaths } from "./paths/progress";
import { pronunciationPaths } from "./paths/pronunciation";
import { researchSourcePaths } from "./paths/research-sources";
import { reviewFlagPaths } from "./paths/review-flags";
import { sessionPaths } from "./paths/sessions";
import { speechClipPaths } from "./paths/speech-clips";
import { studySessionPaths } from "./paths/study-sessions";
import { subscriptionPaths } from "./paths/subscriptions";
import { todayPaths } from "./paths/today";
import { usernamePaths } from "./paths/usernames";
import { internalErrorResponse } from "./schemas/responses";
import { SECURITY_SCHEMES, createSecuritySchemes } from "./security";

/**
 * Documents the JSON error returned when a public product handler fails before
 * producing its response.
 */
function withInternalErrorResponse(
  operation: ZodOpenApiOperationObject,
): ZodOpenApiOperationObject {
  return { ...operation, responses: { ...operation.responses, "500": internalErrorResponse } };
}

/**
 * Adds the shared unexpected-error response to every standard operation on one
 * product API path.
 */
function withInternalErrorResponsesForPath(
  pathItem: ZodOpenApiPathItemObject,
): ZodOpenApiPathItemObject {
  return {
    ...pathItem,
    ...(pathItem.get && { get: withInternalErrorResponse(pathItem.get) }),
    ...(pathItem.put && { put: withInternalErrorResponse(pathItem.put) }),
    ...(pathItem.post && { post: withInternalErrorResponse(pathItem.post) }),
    ...(pathItem.delete && { delete: withInternalErrorResponse(pathItem.delete) }),
    ...(pathItem.options && { options: withInternalErrorResponse(pathItem.options) }),
    ...(pathItem.head && { head: withInternalErrorResponse(pathItem.head) }),
    ...(pathItem.patch && { patch: withInternalErrorResponse(pathItem.patch) }),
    ...(pathItem.trace && { trace: withInternalErrorResponse(pathItem.trace) }),
  };
}

/**
 * Keeps the generated contract aligned with the shared product route boundary.
 * The health check owns its small infrastructure response directly.
 */
function withInternalErrorResponses(paths: ZodOpenApiPathsObject): ZodOpenApiPathsObject {
  return Object.fromEntries(
    Object.entries(paths).map(([path, pathItem]) => [
      path,
      path === "/auth/health" ? pathItem : withInternalErrorResponsesForPath(pathItem),
    ]),
  );
}

const paths = withInternalErrorResponses({
  ...accountPaths,
  ...catalogPaths,
  ...catalogResourcePaths,
  ...checkpointPaths,
  ...contentGenerationPaths,
  ...courseGoalPaths,
  ...currentLearningPaths,
  ...examPaths,
  ...generationPaths,
  ...guardianPaths,
  ...guestPaths,
  ...instrumentWaitlistPaths,
  ...languagePaths,
  ...languageGoalPaths,
  ...languageConversationPaths,
  ...pronunciationPaths,
  ...speechClipPaths,
  ...learnerProfilePaths,
  ...libraryLessonPaths,
  ...lessonRegenerationPaths,
  ...reviewFlagPaths,
  ...lessonQuestionPaths,
  ...currentUserProgressPaths,
  ...usernamePaths,
  ...feedbackPaths,
  ...filePaths,
  ...progressPaths,
  ...sessionPaths,
  ...exampleLinePaths,
  ...subscriptionPaths,
  ...learnerPaths,
  ...learnViewPaths,
  ...placementPaths,
  ...goalPaths,
  ...goalMapPaths,
  ...planPaths,
  ...memoryPaths,
  ...milestonePaths,
  ...mindMapPaths,
  ...mistakePaths,
  ...mockPaths,
  ...onboardingPaths,
  ...researchSourcePaths,
  ...studySessionPaths,
  ...todayPaths,
});

/** OpenAPI 3.0 uses singular `example`, while the canonical 3.1 schemas use JSON Schema's `examples` array. */
function getDocumentOptions(openapi: ZodOpenApiVersion): CreateDocumentOptions | undefined {
  if (!openapi.startsWith("3.0.")) {
    return undefined;
  }

  return {
    override: ({ jsonSchema }) => {
      const example = jsonSchema.examples?.[0];

      if (example === undefined) {
        return;
      }

      Object.assign(jsonSchema, { example });
      delete jsonSchema.examples;
    },
  };
}

export function createOpenAPIDocument({
  cookieName,
  openapi,
}: {
  cookieName?: string;
  openapi: ZodOpenApiVersion;
}) {
  const securitySchemes = cookieName ? createSecuritySchemes({ cookieName }) : SECURITY_SCHEMES;

  return createDocument(
    {
      components: { securitySchemes },
      info: {
        description: "API for the Zoonk learning platform",
        title: "Zoonk API",
        version: "1.0.0",
      },
      openapi,
      paths,
      servers: [{ description: "API v1", url: "/v1" }],
    },
    getDocumentOptions(openapi),
  );
}
