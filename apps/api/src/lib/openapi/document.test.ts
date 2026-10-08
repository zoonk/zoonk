import {
  USERNAME_ALLOWED_CHARACTERS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@zoonk/auth/username-rules";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createOpenAPIDocument } from "./create-document";
import { openAPIDocument } from "./document";
import { courseResultSchema } from "./schemas/courses";
import { serializedStepSchema } from "./schemas/language-exercise";
import { meResponseSchema } from "./schemas/me";
import {
  chapterCompletionResponseSchema,
  courseCompletionResponseSchema,
  nextLessonResponseSchema,
} from "./schemas/progress";

const UUID = "00000000-0000-4000-8000-000000000001";
const ISO_DATE = "2026-07-25T12:00:00.000Z";
const DOCUMENTED_METHODS = ["delete", "get", "patch", "post", "put"] as const;

const CANONICAL_OPERATIONS = [
  { method: "post", operationId: "createEmailSignInCode", path: "/email-sign-in-codes" },
  { method: "post", operationId: "createAppleSession", path: "/sessions/apple" },
  { method: "delete", operationId: "deleteCurrentSession", path: "/sessions/current" },
  { method: "post", operationId: "createEmailCodeSession", path: "/sessions/email-code" },
  { method: "post", operationId: "createGoogleSession", path: "/sessions/google" },
  { method: "get", operationId: "searchCatalog", path: "/catalog/search" },
  { method: "get", operationId: "listCourses", path: "/courses" },
  { method: "get", operationId: "getCourse", path: "/courses/{courseId}" },
  { method: "get", operationId: "listCourseChapters", path: "/courses/{courseId}/chapters" },
  { method: "get", operationId: "getChapter", path: "/chapters/{chapterId}" },
  { method: "get", operationId: "listChapterLessons", path: "/chapters/{chapterId}/lessons" },
  { method: "get", operationId: "listCurrentUserCourses", path: "/me/courses" },
  {
    method: "put",
    operationId: "voteOnContent",
    path: "/me/content-votes/{contentKind}/{contentId}",
  },
  { method: "get", operationId: "getCurrentUserProgress", path: "/me/progress" },
  { method: "get", operationId: "getCurrentUserActivity", path: "/me/progress/activity" },
  { method: "get", operationId: "getCurrentUserEnergy", path: "/me/progress/energy" },
  { method: "get", operationId: "getCurrentUserLevel", path: "/me/progress/level" },
  { method: "get", operationId: "getCurrentUserScore", path: "/me/progress/score" },
  {
    method: "get",
    operationId: "getCurrentUserScorePatterns",
    path: "/me/progress/score/patterns",
  },
  { method: "post", operationId: "createAppleSubscription", path: "/me/subscriptions/apple" },
  {
    method: "post",
    operationId: "createAppleSubscriptionNotification",
    path: "/subscriptions/apple/notifications",
  },
  {
    method: "get",
    operationId: "getUsernameAvailability",
    path: "/usernames/{username}/availability",
  },
  { method: "get", operationId: "getLessonQuestionThread", path: "/lessons/{lessonId}/questions" },
  { method: "post", operationId: "createLessonQuestion", path: "/lessons/{lessonId}/questions" },
  { method: "get", operationId: "getLessonQuestion", path: "/questions/{questionId}" },
  {
    method: "post",
    operationId: "createLessonQuestionAnswer",
    path: "/questions/{questionId}/answers",
  },
  { method: "get", operationId: "getCourseProgress", path: "/courses/{courseId}/progress" },
  { method: "get", operationId: "getChapterProgress", path: "/chapters/{chapterId}/progress" },
  { method: "get", operationId: "getCourseNextLesson", path: "/courses/{courseId}/next-lesson" },
  { method: "get", operationId: "getChapterNextLesson", path: "/chapters/{chapterId}/next-lesson" },
  { method: "post", operationId: "createGuestSession", path: "/guests" },
  { method: "get", operationId: "getLibraryLesson", path: "/library/lessons/{lessonId}" },
  {
    method: "post",
    operationId: "createLibraryLessonStart",
    path: "/library/lessons/{lessonId}/starts",
  },
  {
    method: "post",
    operationId: "createLibraryLessonCompletion",
    path: "/library/lessons/{lessonId}/completions",
  },
  { method: "post", operationId: "createStepCheck", path: "/steps/{stepId}/checks" },
  {
    method: "post",
    operationId: "createStepAnswerExplanation",
    path: "/steps/{stepId}/answer-explanations",
  },
  { method: "get", operationId: "getCurrentUserAllowance", path: "/me/allowance" },
  { method: "get", operationId: "getCurrentUserDailyTimeLimit", path: "/me/daily-time-limit" },
  { method: "get", operationId: "getCurrentUserLearningProfile", path: "/me/learning-profile" },
  {
    method: "patch",
    operationId: "updateCurrentUserLearningProfile",
    path: "/me/learning-profile",
  },
  { method: "get", operationId: "listCurrentUserGuardianLinks", path: "/me/guardian-links" },
  { method: "post", operationId: "inviteGuardian", path: "/me/guardian-links" },
  { method: "delete", operationId: "revokeGuardianLink", path: "/me/guardian-links/{linkId}" },
  { method: "post", operationId: "acceptGuardianInvite", path: "/me/guardian-invite-acceptances" },
  { method: "get", operationId: "listGuardedLearners", path: "/me/guarded-learners" },
  { method: "patch", operationId: "updateGuardedLearner", path: "/me/guarded-learners/{linkId}" },
  {
    method: "post",
    operationId: "approveGuardedLearnerPlus",
    path: "/me/guarded-learners/{linkId}/plus-approval",
  },
  { method: "post", operationId: "requestPlusApproval", path: "/me/plus-approval-requests" },
  { method: "get", operationId: "getGeneration", path: "/generations/{generationId}" },
  {
    method: "get",
    operationId: "streamGenerationEvents",
    path: "/generations/{generationId}/events",
  },
] as const;

const responseContractSchema = z.object({ description: z.string() }).loose();

const operationContractSchema = z
  .object({
    deprecated: z.boolean().optional(),
    operationId: z.string().min(1),
    responses: z.record(z.string(), responseContractSchema),
    security: z.array(z.record(z.string(), z.array(z.string()))),
  })
  .loose();

const pathItemContractSchema = z
  .object({
    delete: operationContractSchema.optional(),
    get: operationContractSchema.optional(),
    patch: operationContractSchema.optional(),
    post: operationContractSchema.optional(),
    put: operationContractSchema.optional(),
  })
  .loose();

const documentContractSchema = z
  .object({
    components: z
      .object({
        schemas: z.record(z.string(), z.unknown()),
        securitySchemes: z
          .object({
            bearerAuth: z.object({ scheme: z.literal("bearer"), type: z.literal("http") }),
            cookieAuth: z.object({
              in: z.literal("cookie"),
              name: z.string().min(1),
              type: z.literal("apiKey"),
            }),
          })
          .loose(),
      })
      .loose(),
    paths: z.record(z.string(), pathItemContractSchema),
  })
  .loose();

/**
 * OpenAPI 3.0 only knows singular `example`. A schema property that happens to be named
 * `examples` (an activity's formula examples) is data, not the keyword.
 */
function hasExamplesKeyword(value: unknown, parentKey?: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasExamplesKeyword(item));
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.entries(value).some(
    ([key, child]) =>
      (key === "examples" && parentKey !== "properties") || hasExamplesKeyword(child, key),
  );
}

describe("OpenAPI document", () => {
  it("keeps the public contract on OpenAPI 3.1", () => {
    expect(openAPIDocument.openapi).toBe("3.1.0");
  });

  it("creates an OpenAPI 3.0 compatibility document for Swift generation", () => {
    const swiftDocument = createOpenAPIDocument({
      cookieName: "__Secure-better-auth.session_token",
      openapi: "3.0.3",
    });

    expect(swiftDocument.openapi).toBe("3.0.3");
    expect(hasExamplesKeyword(swiftDocument)).toBe(false);

    expect(swiftDocument.components?.securitySchemes?.cookieAuth).toMatchObject({
      name: "__Secure-better-auth.session_token",
    });
  });

  it("owns its authentication schemes without publishing Better Auth internals", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.components.securitySchemes).toMatchObject({
      bearerAuth: { scheme: "bearer", type: "http" },
      cookieAuth: { in: "cookie", name: "better-auth.session_token", type: "apiKey" },
    });

    expect(document.paths).not.toHaveProperty("/sign-in/email");
    expect(document.paths).not.toHaveProperty("/sign-up/email");
    expect(document.paths).not.toHaveProperty("/sign-out");
    expect(document.paths).not.toHaveProperty("/auth/sign-in/apple-native");

    expect(
      Object.keys(document.paths)
        .filter((path) => path !== "/auth/health")
        .every((path) => !path.startsWith("/auth/")),
    ).toBe(true);
  });

  it("gives every public operation a unique ID and an explicit security contract", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    const operations = Object.values(document.paths).flatMap((pathItem) =>
      DOCUMENTED_METHODS.flatMap((method) => {
        const operation = pathItem[method];
        return operation ? [operation] : [];
      }),
    );

    const operationIds = operations.map((operation) => operation.operationId);

    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(operations.every((operation) => Array.isArray(operation.security))).toBe(true);
  });

  it("documents the shared internal error response for every product operation", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    const operations = Object.entries(document.paths).flatMap(([path, pathItem]) =>
      DOCUMENTED_METHODS.flatMap((method) => {
        const operation = pathItem[method];

        return operation ? [{ method, operation, path }] : [];
      }),
    );

    const productOperationsWithoutInternalErrors = operations
      .filter(({ path }) => path !== "/auth/health")
      .filter(({ operation }) => !Object.hasOwn(operation.responses, "500"))
      .map(({ method, path }) => `${method.toUpperCase()} ${path}`);

    expect(productOperationsWithoutInternalErrors).toStrictEqual([]);
    expect(document.paths["/auth/health"]?.get?.responses).not.toHaveProperty("500");
  });

  it("publishes every canonical operation without deprecation", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    for (const { method, operationId, path } of CANONICAL_OPERATIONS) {
      const operation = document.paths[path]?.[method];

      expect(operation?.operationId).toBe(operationId);
      expect(operation).not.toHaveProperty("deprecated");
    }
  });

  it("documents public and user-authenticated endpoint security", () => {
    const document = documentContractSchema.parse(openAPIDocument);
    const authenticated = [{ bearerAuth: [] }, { cookieAuth: [] }];
    const optionalAuthentication = [{}, ...authenticated];

    expect(document.paths["/auth/health"]?.get?.security).toStrictEqual([]);
    expect(document.paths["/courses"]?.get?.security).toStrictEqual([]);
    expect(document.paths["/feedback"]?.post?.security).toStrictEqual(optionalAuthentication);
    expect(document.paths["/me"]?.get?.security).toStrictEqual(authenticated);
    expect(document.paths["/me"]?.patch?.security).toStrictEqual(authenticated);
    expect(document.paths["/me/subscriptions/apple"]?.post?.security).toStrictEqual(authenticated);
    expect(document.paths["/subscriptions/apple/notifications"]?.post?.security).toStrictEqual([]);
  });

  it("documents native session endpoint security", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.paths["/email-sign-in-codes"]?.post?.security).toStrictEqual([]);
    expect(document.paths["/email-sign-in-codes"]?.post?.responses).toHaveProperty("403");
    expect(document.paths["/sessions/apple"]?.post?.security).toStrictEqual([]);
    expect(document.paths["/sessions/apple"]?.post?.responses).toHaveProperty("403");
    expect(document.paths["/sessions/email-code"]?.post?.security).toStrictEqual([]);
    expect(document.paths["/sessions/email-code"]?.post?.responses).toHaveProperty("403");
    expect(document.paths["/sessions/google"]?.post?.security).toStrictEqual([]);
    expect(document.paths["/sessions/google"]?.post?.responses).toHaveProperty("403");
  });

  it("documents idempotent sign-out with authenticated client generation", () => {
    const document = documentContractSchema.parse(openAPIDocument);
    const authenticated = [{ bearerAuth: [] }, { cookieAuth: [] }];

    expect(document.paths["/sessions/current"]?.delete?.security).toStrictEqual(authenticated);
    expect(document.paths["/sessions/current"]?.delete?.responses).not.toHaveProperty("401");
  });

  it("documents stable native session error codes without closing the error code set", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.paths["/sessions/email-code"]?.post?.responses["400"]?.description).toContain(
      "EMAIL_SIGN_IN_CODE_INVALID",
    );

    expect(document.paths["/sessions/apple"]?.post?.responses["401"]?.description).toContain(
      "APPLE_AUTHORIZATION_INVALID",
    );

    expect(document.paths["/sessions/google"]?.post?.responses["401"]?.description).toContain(
      "GOOGLE_AUTHORIZATION_INVALID",
    );

    expect(document.paths["/sessions/google"]?.post?.responses["429"]?.description).toContain(
      "RATE_LIMIT_EXCEEDED",
    );

    expect(document.components.schemas.Error).toMatchObject({
      properties: { error: { properties: { code: { type: "string" } } } },
    });
  });

  it("documents retry timing for native session rate limits", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.paths["/sessions/apple"]?.post?.responses["429"]).toMatchObject({
      headers: { "Retry-After": { schema: { minimum: 0, type: "integer" } } },
    });
  });

  it("documents the course collection as a browse-only resource", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    const parameters = z
      .array(z.object({ name: z.string(), required: z.boolean().optional() }).loose())
      .parse(document.paths["/courses"]?.get?.parameters);

    expect(parameters).toContainEqual(
      expect.objectContaining({ name: "language", required: true }),
    );

    expect(parameters.map((parameter) => parameter.name)).not.toContain("query");
  });

  it("documents complete curriculum collections without pagination", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    const courseChapterParameters = z
      .array(z.object({ name: z.string() }).loose())
      .parse(document.paths["/courses/{courseId}/chapters"]?.get?.parameters);

    const chapterLessonParameters = z
      .array(z.object({ name: z.string() }).loose())
      .parse(document.paths["/chapters/{chapterId}/lessons"]?.get?.parameters);

    expect(courseChapterParameters.map((parameter) => parameter.name)).toStrictEqual(["courseId"]);

    expect(chapterLessonParameters.map((parameter) => parameter.name)).toStrictEqual([
      "chapterId",
      "courseId",
    ]);

    expect(document.components.schemas.CourseChapterListResponse).not.toHaveProperty(
      "properties.pagination",
    );

    expect(document.components.schemas.ChapterLessonListResponse).not.toHaveProperty(
      "properties.pagination",
    );
  });

  it("documents account and bounded request constraints for generated clients", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.paths["/me"]?.get).toMatchObject({ tags: ["Account"] });
    expect(document.paths["/me"]?.patch).toMatchObject({ tags: ["Account"] });

    expect(document.components.schemas.MeUpdate).toMatchObject({
      additionalProperties: false,
      minProperties: 1,
      properties: {
        username: {
          maxLength: USERNAME_MAX_LENGTH,
          minLength: USERNAME_MIN_LENGTH,
          pattern: USERNAME_ALLOWED_CHARACTERS.source,
        },
      },
    });

    const meDeletionSchema = z
      .object({ oneOf: z.array(z.object({ required: z.array(z.string()).optional() }).loose()) })
      .parse(document.components.schemas.MeDeletion);

    expect(meDeletionSchema.oneOf.map((variant) => variant.required ?? [])).toStrictEqual([
      [],
      ["appleCredentials"],
      ["emailCredentials"],
    ]);
  });

  it("documents optional reads and public generation status", () => {
    const document = documentContractSchema.parse(openAPIDocument);
    const optionalAuthentication = [{}, { bearerAuth: [] }, { cookieAuth: [] }];

    expect(document.paths["/courses/{courseId}/next-lesson"]?.get?.security).toStrictEqual(
      optionalAuthentication,
    );

    expect(document.paths["/generations/{generationId}"]?.get?.security).toStrictEqual([]);
    expect(document.paths["/generations/{generationId}/events"]?.get?.security).toStrictEqual([]);
  });

  it("documents every response status returned by account and feedback routes", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.paths["/feedback"]?.post?.responses).toHaveProperty("500");
    expect(document.paths["/me"]?.delete?.responses).toHaveProperty("500");
    expect(document.paths["/me"]?.patch?.responses).toHaveProperty("500");
    expect(document.paths["/me"]?.patch?.responses).toHaveProperty("403");
    expect(document.paths["/feedback"]?.post?.responses).toHaveProperty("403");
  });

  it("documents unexpected errors for native session routes", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.paths["/email-sign-in-codes"]?.post?.responses).toHaveProperty("500");
    expect(document.paths["/sessions/apple"]?.post?.responses).toHaveProperty("500");
    expect(document.paths["/sessions/current"]?.delete?.responses).toHaveProperty("500");
    expect(document.paths["/sessions/email-code"]?.post?.responses).toHaveProperty("500");
    expect(document.paths["/sessions/google"]?.post?.responses).toHaveProperty("500");
  });

  it("documents every response status returned by generation routes", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.paths["/generations/{generationId}"]?.get?.responses).toHaveProperty("400");
    expect(document.paths["/generations/{generationId}"]?.get?.responses).toHaveProperty("404");

    expect(document.paths["/generations/{generationId}/events"]?.get?.responses).toHaveProperty(
      "400",
    );

    expect(document.paths["/generations/{generationId}/events"]?.get?.responses).toHaveProperty(
      "404",
    );
  });

  it("documents every response status returned by progress routes", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.paths["/courses/{courseId}/progress"]?.get?.responses).toHaveProperty("404");
    expect(document.paths["/chapters/{chapterId}/progress"]?.get?.responses).toHaveProperty("404");
    expect(document.paths["/courses/{courseId}/next-lesson"]?.get?.responses).toHaveProperty("404");

    expect(document.paths["/chapters/{chapterId}/next-lesson"]?.get?.responses).toHaveProperty(
      "404",
    );
  });

  it("documents generation status and its streamed event payloads precisely", () => {
    const document = documentContractSchema.parse(openAPIDocument);
    const generationEvents = document.paths["/generations/{generationId}/events"]?.get;

    expect(document.components.schemas.Generation).toMatchObject({
      properties: {
        id: { type: "string" },
        status: { enum: ["pending", "running", "completed", "failed", "cancelled"] },
      },
      required: ["id", "status"],
      type: "object",
    });

    expect(generationEvents?.responses["200"]).toMatchObject({
      content: { "text/event-stream": { schema: { type: "string" } } },
    });

    expect(generationEvents?.parameters).toContainEqual(
      expect.objectContaining({
        in: "query",
        name: "startIndex",
        schema: expect.objectContaining({ minimum: 0 }),
      }),
    );

    expect(document.paths).not.toHaveProperty("/course-generations");
    expect(document.paths).not.toHaveProperty("/chapter-generations/{generationId}/events");
    expect(document.paths).not.toHaveProperty("/lesson-generations/{generationId}/events");
    expect(document.paths).not.toHaveProperty("/chapters/{chapterId}/generation");
    expect(document.paths).not.toHaveProperty("/chapters/{chapterId}/generations");
    expect(document.paths).not.toHaveProperty("/lessons/{lessonId}/generation");
    expect(document.paths).not.toHaveProperty("/lessons/{lessonId}/generations");
  });

  it("documents authenticated lesson questions and UI message streams", () => {
    const document = documentContractSchema.parse(openAPIDocument);
    const authenticated = [{ bearerAuth: [] }, { cookieAuth: [] }];
    const questions = document.paths["/lessons/{lessonId}/questions"];
    const answers = document.paths["/questions/{questionId}/answers"];

    expect(questions?.get).toMatchObject({
      operationId: "getLessonQuestionThread",
      responses: {
        "200": {
          content: {
            "application/json": {
              schema: {
                anyOf: [{ $ref: "#/components/schemas/LessonQuestionThread" }, { type: "null" }],
              },
            },
          },
        },
      },
      security: authenticated,
    });

    expect(questions?.get?.parameters).toContainEqual(
      expect.objectContaining({
        in: "query",
        name: "cursor",
        schema: expect.objectContaining({ format: "uuid" }),
      }),
    );

    expect(questions?.post).toMatchObject({
      operationId: "createLessonQuestion",
      requestBody: { required: true },
      responses: {
        "201": expect.any(Object),
        "401": expect.any(Object),
        "404": expect.any(Object),
        "409": expect.any(Object),
        "422": expect.any(Object),
      },
      security: authenticated,
    });

    expect(answers?.post).toMatchObject({
      operationId: "createLessonQuestionAnswer",
      responses: {
        "200": { content: { "text/event-stream": { schema: { type: "string" } } } },
        "402": expect.any(Object),
        "403": expect.any(Object),
        "409": expect.any(Object),
        "429": expect.any(Object),
      },
      security: authenticated,
    });

    expect(document.components.schemas.CreateLessonQuestionRequest).toMatchObject({
      properties: {
        context: { $ref: "#/components/schemas/LessonQuestionContextInput" },
        question: { maxLength: 2000, minLength: 1, type: "string" },
        requestId: { format: "uuid", type: "string" },
      },
      required: ["context", "question", "requestId"],
      type: "object",
    });

    expect(document.components.schemas.LessonQuestion).toMatchObject({
      properties: {
        answer: { type: ["string", "null"] },
        id: { format: "uuid" },
        status: { enum: ["pending", "running", "completed", "failed"] },
      },
      required: expect.arrayContaining(["id", "question", "answer", "status"]),
      type: "object",
    });

    expect(document.components.schemas.LessonQuestionThread).toMatchObject({
      properties: {
        hasMore: { type: "boolean" },
        nextCursor: { anyOf: [expect.objectContaining({ format: "uuid" }), { type: "null" }] },
      },
      required: expect.arrayContaining(["hasMore", "nextCursor", "questions"]),
      type: "object",
    });

    // The plan's "Ask" answers about its course; there is no course tutor.
    expect(document.paths).not.toHaveProperty("/courses/{courseId}/questions");
  });

  it("emits client-visible formats and next-lesson variants", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.components.schemas.CourseResult).toMatchObject({
      properties: { id: { format: "uuid" } },
    });

    expect(document.components.schemas.OrganizationSummary).toMatchObject({
      properties: { id: { format: "uuid" } },
    });

    expect(document.components.schemas.MeUser).toMatchObject({
      properties: {
        createdAt: { format: "date-time" },
        id: { format: "uuid" },
        updatedAt: { format: "date-time" },
      },
    });

    expect(document.components.schemas.MeSubscription).toMatchObject({
      properties: {
        id: { format: "uuid" },
        periodEnd: { anyOf: [{ format: "date-time" }, { type: "null" }] },
        periodStart: { anyOf: [{ format: "date-time" }, { type: "null" }] },
      },
    });

    const nextLessonSchema = z
      .object({
        discriminator: z.object({
          mapping: z.record(z.string(), z.string()),
          propertyName: z.literal("type"),
        }),
        oneOf: z.array(z.object({ $ref: z.string() })),
      })
      .parse(document.components.schemas.NextLessonResponse);

    expect(nextLessonSchema.discriminator.mapping).toStrictEqual({
      chapter: "#/components/schemas/NextLessonChapterResponse",
      empty: "#/components/schemas/NextLessonEmptyResponse",
      lesson: "#/components/schemas/NextLessonLessonResponse",
    });

    expect(nextLessonSchema.oneOf.map((variant) => variant.$ref)).toStrictEqual([
      "#/components/schemas/NextLessonEmptyResponse",
      "#/components/schemas/NextLessonChapterResponse",
      "#/components/schemas/NextLessonLessonResponse",
    ]);

    expect(document.paths["/courses/{courseId}/next-lesson"]?.get).toMatchObject({
      parameters: [{ in: "path", name: "courseId", required: true, schema: { format: "uuid" } }],
    });

    expect(document.paths["/me"]?.delete).toMatchObject({
      operationId: "deleteCurrentUser",
      responses: {
        "200": { description: "Account deleted with provider revocation outcome" },
        "400": expect.any(Object),
        "401": expect.any(Object),
        "403": expect.any(Object),
        "500": expect.any(Object),
      },
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    });
  });
});

describe("OpenAPI response schemas", () => {
  it("uses UUIDs for course and organization identifiers", () => {
    const result = {
      description: null,
      id: UUID,
      imageUrl: null,
      language: "en",
      organization: { id: UUID, logo: null, name: "Zoonk", slug: "zoonk" },
      slug: "course",
      title: "Course",
    };

    expect(courseResultSchema.safeParse(result).success).toBe(true);
    expect(courseResultSchema.safeParse({ ...result, id: 1 }).success).toBe(false);

    expect(
      courseResultSchema.safeParse({ ...result, organization: { ...result.organization, id: 1 } })
        .success,
    ).toBe(false);
  });

  it("uses UUID and ISO date-time formats for the current user", () => {
    const response = {
      account: {
        deletion: { hasAppleAccount: false },
        hasActiveSubscription: true,
        subscription: {
          cancelAt: null,
          cancelAtPeriodEnd: false,
          id: UUID,
          periodEnd: ISO_DATE,
          periodStart: ISO_DATE,
          plan: "plus",
          provider: "stripe",
          status: "active",
        },
      },
      user: {
        analyticsDisabled: false,
        createdAt: ISO_DATE,
        displayUsername: null,
        email: "learner@example.com",
        emailVerified: true,
        id: UUID,
        image: null,
        name: "Learner",
        updatedAt: ISO_DATE,
        username: null,
      },
    };

    expect(meResponseSchema.safeParse(response).success).toBe(true);

    expect(
      meResponseSchema.safeParse({
        ...response,
        user: { ...response.user, createdAt: "July 25", id: "1" },
      }).success,
    ).toBe(false);

    expect(
      meResponseSchema.safeParse({
        ...response,
        account: {
          ...response.account,
          subscription: { ...response.account.subscription, id: "1", periodEnd: "July 25" },
        },
      }).success,
    ).toBe(false);
  });

  it.each([
    { completed: false, hasStarted: false, type: "empty" },
    {
      canPrefetch: false,
      chapterId: UUID,
      chapterSlug: "chapter",
      completed: false,
      courseId: UUID,
      courseSlug: "course",
      hasStarted: true,
      organizationSlug: "zoonk",
      type: "chapter",
    },
    {
      canPrefetch: true,
      chapterId: UUID,
      chapterSlug: "chapter",
      completed: false,
      courseId: UUID,
      courseSlug: "course",
      hasStarted: true,
      lessonId: UUID,
      lessonPosition: 0,
      lessonSlug: "lesson",
      organizationSlug: "zoonk",
      type: "lesson",
    },
  ])("accepts the next-lesson response variant %#", (response) => {
    expect(nextLessonResponseSchema.safeParse(response).success).toBe(true);
  });

  it("rejects a next-lesson target without its prefetch decision", () => {
    expect(
      nextLessonResponseSchema.safeParse({
        chapterId: UUID,
        chapterSlug: "chapter",
        completed: false,
        courseId: UUID,
        courseSlug: "course",
        hasStarted: true,
        lessonId: UUID,
        lessonPosition: 0,
        lessonSlug: "lesson",
        organizationSlug: "zoonk",
        type: "lesson",
      }).success,
    ).toBe(false);
  });

  it("requires an explicit next-learning target discriminator", () => {
    expect(
      nextLessonResponseSchema.safeParse({
        canPrefetch: true,
        chapterId: UUID,
        chapterSlug: "chapter",
        completed: false,
        courseId: UUID,
        courseSlug: "course",
        hasStarted: true,
        lessonId: UUID,
        lessonPosition: 0,
        lessonSlug: "lesson",
        organizationSlug: "zoonk",
      }).success,
    ).toBe(false);
  });

  it("uses UUIDs for completion response identifiers", () => {
    expect(
      chapterCompletionResponseSchema.safeParse({
        lessons: [{ isCompleted: false, lessonId: "1" }],
        percentComplete: 0,
      }).success,
    ).toBe(false);

    expect(
      courseCompletionResponseSchema.safeParse({
        chapters: [{ chapterId: "1", completedLessons: 0, totalLessons: 1 }],
        percentComplete: 0,
      }).success,
    ).toBe(false);
  });

  it("types the content of each serialized language exercise", () => {
    const step = {
      content: {
        options: [{ feedback: "Right", id: "cloud", isCorrect: true, text: "A cloud" }],
        question: "How do we picture an electron today?",
      },
      fillBlankOptions: [],
      id: UUID,
      kind: "multipleChoice",
      matchColumnsRightItems: [],
      position: 0,
      sentence: null,
      sentenceWordOptions: [],
      translationOptions: [],
      vocabularyOptions: [],
      word: null,
      wordBankOptions: [],
    };

    expect(serializedStepSchema.safeParse(step).success).toBe(true);

    expect(
      serializedStepSchema.safeParse({ ...step, content: { text: "Untyped content" } }).success,
    ).toBe(false);
  });
});
