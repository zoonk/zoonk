import {
  USERNAME_ALLOWED_CHARACTERS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@zoonk/auth/username-rules";
import {
  COURSE_LANGUAGE_MAX_LENGTH,
  COURSE_PROMPT_MAX_LENGTH,
} from "@zoonk/core/courses/prompt-contract";
import { TTS_SUPPORTED_LANGUAGE_CODES } from "@zoonk/utils/languages";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { openAPIDocument } from "./document";
import { courseResultSchema } from "./schemas/courses";
import { courseContinuationListResponseSchema } from "./schemas/current-learning";
import { lessonContentResponseSchema } from "./schemas/lesson-resources";
import { meResponseSchema } from "./schemas/me";
import {
  chapterCompletionResponseSchema,
  courseCompletionResponseSchema,
  nextLessonResponseSchema,
} from "./schemas/progress";

const UUID = "00000000-0000-4000-8000-000000000001";
const ISO_DATE = "2026-07-25T12:00:00.000Z";
const DOCUMENTED_METHODS = ["get", "patch", "post"] as const;

const CANONICAL_OPERATIONS = [
  { method: "get", operationId: "searchCatalog", path: "/catalog/search" },
  { method: "get", operationId: "listCourses", path: "/courses" },
  { method: "get", operationId: "getCourse", path: "/courses/{courseId}" },
  { method: "get", operationId: "listCourseChapters", path: "/courses/{courseId}/chapters" },
  { method: "get", operationId: "getChapter", path: "/chapters/{chapterId}" },
  { method: "get", operationId: "listChapterLessons", path: "/chapters/{chapterId}/lessons" },
  { method: "get", operationId: "getLesson", path: "/lessons/{lessonId}" },
  { method: "get", operationId: "listLanguageCourses", path: "/language-courses" },
  { method: "get", operationId: "listCurrentUserCourses", path: "/me/courses" },
  {
    method: "get",
    operationId: "listCurrentUserCourseContinuations",
    path: "/me/course-continuations",
  },
  { method: "get", operationId: "getCurrentUserLessonVisibility", path: "/me/lesson-visibility" },
  {
    method: "patch",
    operationId: "updateCurrentUserLessonVisibility",
    path: "/me/lesson-visibility",
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
  { method: "get", operationId: "getCurrentUserProgressSnapshot", path: "/me/progress/snapshot" },
  {
    method: "get",
    operationId: "getUsernameAvailability",
    path: "/usernames/{username}/availability",
  },
  { method: "get", operationId: "getLessonContent", path: "/lessons/{lessonId}/content" },
  { method: "post", operationId: "createLessonStart", path: "/lessons/{lessonId}/starts" },
  {
    method: "post",
    operationId: "createLessonCompletion",
    path: "/lessons/{lessonId}/completions",
  },
  { method: "post", operationId: "createLessonPreload", path: "/lessons/{lessonId}/preloads" },
  { method: "post", operationId: "createCoursePrompt", path: "/course-prompts" },
  { method: "get", operationId: "getCoursePrompt", path: "/course-prompts/{coursePromptId}" },
  { method: "get", operationId: "getCourseProgress", path: "/courses/{courseId}/progress" },
  { method: "get", operationId: "getChapterProgress", path: "/chapters/{chapterId}/progress" },
  { method: "get", operationId: "getCourseNextLesson", path: "/courses/{courseId}/next-lesson" },
  { method: "get", operationId: "getChapterNextLesson", path: "/chapters/{chapterId}/next-lesson" },
  { method: "get", operationId: "getLessonSuccessor", path: "/lessons/{lessonId}/next-lesson" },
  { method: "post", operationId: "createGeneration", path: "/generations" },
  { method: "get", operationId: "getGeneration", path: "/generations/{generationId}" },
  {
    method: "get",
    operationId: "streamGenerationEvents",
    path: "/generations/{generationId}/events",
  },
] as const;

const operationContractSchema = z
  .object({
    deprecated: z.boolean().optional(),
    operationId: z.string().min(1),
    responses: z.record(z.string(), z.unknown()),
    security: z.array(z.record(z.string(), z.array(z.string()))),
  })
  .loose();

const pathItemContractSchema = z
  .object({
    get: operationContractSchema.optional(),
    patch: operationContractSchema.optional(),
    post: operationContractSchema.optional(),
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

describe("OpenAPI document", () => {
  it("owns its authentication schemes without publishing Better Auth internals", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.components.securitySchemes).toMatchObject({
      bearerAuth: { scheme: "bearer", type: "http" },
      cookieAuth: { in: "cookie", name: "better-auth.session_token", type: "apiKey" },
    });

    expect(document.paths).not.toHaveProperty("/sign-in/email");
    expect(document.paths).not.toHaveProperty("/sign-up/email");
    expect(document.paths).not.toHaveProperty("/sign-out");
  });

  it("gives every public operation a unique ID and an explicit security contract", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    const operations = Object.values(document.paths).flatMap((pathItem) =>
      [pathItem.get, pathItem.patch, pathItem.post].filter(
        (operation): operation is z.infer<typeof operationContractSchema> =>
          operation !== undefined,
      ),
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

    expect(document.paths["/auth/health"]?.get?.security).toStrictEqual([]);
    expect(document.paths["/courses"]?.get?.security).toStrictEqual([]);
    expect(document.paths["/feedback"]?.post?.security).toStrictEqual([]);
    expect(document.paths["/me"]?.get?.security).toStrictEqual(authenticated);
    expect(document.paths["/me"]?.patch?.security).toStrictEqual(authenticated);
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
    expect(chapterLessonParameters.map((parameter) => parameter.name)).toStrictEqual(["chapterId"]);

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

    expect(document.components.schemas.CourseContinuationListResponse).toMatchObject({
      properties: { data: { maxItems: 4 } },
    });

    expect(document.components.schemas.ResolveCoursePromptRequest).toMatchObject({
      oneOf: expect.arrayContaining([
        expect.objectContaining({
          properties: expect.objectContaining({
            language: expect.objectContaining({ maxLength: COURSE_LANGUAGE_MAX_LENGTH }),
            prompt: expect.objectContaining({ maxLength: COURSE_PROMPT_MAX_LENGTH }),
          }),
        }),
      ]),
    });
  });

  it("documents optional authentication and public event streams", () => {
    const document = documentContractSchema.parse(openAPIDocument);
    const optionalAuthentication = [{}, { bearerAuth: [] }, { cookieAuth: [] }];

    expect(document.paths["/courses/{courseId}/next-lesson"]?.get?.security).toStrictEqual(
      optionalAuthentication,
    );

    expect(document.paths["/lessons/{lessonId}/next-lesson"]?.get?.security).toStrictEqual(
      optionalAuthentication,
    );

    expect(document.paths["/generations"]?.post?.security).toStrictEqual(optionalAuthentication);

    expect(document.paths["/generations/{generationId}"]?.get?.security).toStrictEqual([]);
    expect(document.paths["/generations/{generationId}/events"]?.get?.security).toStrictEqual([]);
  });

  it("documents every response status returned by account and feedback routes", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.paths["/course-prompts"]?.post?.responses).toHaveProperty("403");
    expect(document.paths["/feedback"]?.post?.responses).toHaveProperty("500");
    expect(document.paths["/me"]?.patch?.responses).toHaveProperty("500");
    expect(document.paths["/me"]?.patch?.responses).toHaveProperty("403");
    expect(document.paths["/feedback"]?.post?.responses).toHaveProperty("403");
  });

  it("documents every response status returned by generation routes", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.paths["/generations"]?.post?.responses).toHaveProperty("402");
    expect(document.paths["/generations"]?.post?.responses).toHaveProperty("404");
    expect(document.paths["/generations"]?.post?.responses).toHaveProperty("403");
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

  it("documents generation commands and their streamed event payloads precisely", () => {
    const document = documentContractSchema.parse(openAPIDocument);
    const generation = document.paths["/generations"]?.post;
    const generationEvents = document.paths["/generations/{generationId}/events"]?.get;

    expect(generation?.requestBody).toMatchObject({ required: true });

    expect(generation?.responses["202"]).toMatchObject({
      headers: { Location: { schema: { type: "string" } } },
    });

    expect(generation?.responses).not.toHaveProperty("200");

    expect(document.components.schemas.CreateGenerationRequest).toMatchObject({
      properties: { target: { $ref: "#/components/schemas/GenerationTarget" } },
      required: ["target"],
      type: "object",
    });

    expect(document.components.schemas.GenerationTarget).toMatchObject({
      properties: { id: { format: "uuid" }, type: { enum: ["coursePrompt", "chapter", "lesson"] } },
      required: ["id", "type"],
      type: "object",
    });

    expect(document.components.schemas.LessonGenerationTarget).toMatchObject({
      properties: { kind: { enum: ["lesson", "sourceLesson"] }, lessonId: { format: "uuid" } },
      required: ["kind", "lessonId"],
      type: "object",
    });

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
        discriminator: z.object({ propertyName: z.literal("type") }),
        oneOf: z.array(
          z
            .object({
              properties: z.object({ type: z.object({ const: z.string() }).loose() }).loose(),
            })
            .loose(),
        ),
      })
      .parse(document.components.schemas.NextLessonResponse);

    expect(nextLessonSchema.discriminator.propertyName).toBe("type");

    expect(nextLessonSchema.oneOf.map((variant) => variant.properties.type.const)).toStrictEqual([
      "empty",
      "chapter",
      "lesson",
    ]);

    expect(document.paths["/courses/{courseId}/next-lesson"]?.get).toMatchObject({
      parameters: [{ in: "path", name: "courseId", required: true, schema: { format: "uuid" } }],
    });
  });

  it("uses consistent course-prompt identifiers and supported language targets", () => {
    const document = documentContractSchema.parse(openAPIDocument);

    expect(document.components.schemas.CourseResource).toMatchObject({
      properties: { coursePromptId: { anyOf: [{ format: "uuid" }, { type: "null" }] } },
    });

    expect(document.components.schemas.CourseResource).not.toMatchObject({
      properties: { generationPromptId: expect.anything() },
    });

    expect(document.components.schemas.LanguageCourse).toMatchObject({
      properties: { targetLanguage: { enum: [...TTS_SUPPORTED_LANGUAGE_CODES] } },
    });
  });
});

describe("OpenAPI response schemas", () => {
  it("names playable continuation targets ready instead of completed", () => {
    const continuation = {
      chapter: { id: UUID, slug: "chapter", title: "Chapter" },
      course: {
        id: UUID,
        imageUrl: null,
        organization: { slug: "zoonk" },
        slug: "course",
        title: "Course",
      },
      lesson: {
        description: null,
        id: UUID,
        kind: "explanation",
        position: 0,
        slug: "lesson",
        title: "Lesson",
      },
    };

    expect(
      courseContinuationListResponseSchema.safeParse({
        data: [{ ...continuation, status: "ready" }],
      }).success,
    ).toBe(true);

    expect(
      courseContinuationListResponseSchema.safeParse({
        data: [{ ...continuation, status: "completed" }],
      }).success,
    ).toBe(false);
  });

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

  it("documents the player content for each serialized step kind", () => {
    const step = {
      content: { text: "Lesson content", title: "Lesson title", variant: "text" },
      fillBlankOptions: [],
      id: UUID,
      kind: "static",
      matchColumnsRightItems: [],
      position: 0,
      sentence: null,
      sentenceWordOptions: [],
      sortOrderItems: [],
      translationOptions: [],
      vocabularyOptions: [],
      word: null,
      wordBankOptions: [],
    };

    const response = {
      lesson: {
        description: null,
        id: UUID,
        kind: "explanation",
        language: "en",
        lessonSentences: [],
        lessonWords: [],
        organizationId: null,
        steps: [step],
        title: "Lesson",
      },
      status: "ready",
    };

    expect(lessonContentResponseSchema.safeParse(response).success).toBe(true);

    expect(
      lessonContentResponseSchema.safeParse({
        ...response,
        lesson: { ...response.lesson, steps: [{ ...step, content: { text: "Untyped content" } }] },
      }).success,
    ).toBe(false);
  });
});
