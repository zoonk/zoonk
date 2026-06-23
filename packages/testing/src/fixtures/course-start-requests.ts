import { randomUUID } from "node:crypto";
import { type CourseStartRequest, type GenerationStatus, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

type GeneratableCourseStartRequest = CourseStartRequest & {
  canonicalTitle: string;
  generationStatus: GenerationStatus;
};

function courseStartRequestAttrs(
  attrs?: Partial<CourseStartRequest>,
): Omit<CourseStartRequest, "id" | "createdAt" | "updatedAt"> {
  const canonicalTitle = attrs?.canonicalTitle ?? `Test Course Request ${randomUUID()}`;
  const prompt = attrs?.prompt ?? `${canonicalTitle} ${randomUUID()}`;

  return {
    canonicalTitle,
    courseId: null,
    courseMode: "full",
    generationRunId: null,
    generationStatus: "pending",
    language: "en",
    normalizedPrompt: normalizeString(prompt),
    prompt,
    scope: "topic",
    targetLanguage: null,
    ...attrs,
  };
}

/**
 * Creates a durable course-start request for tests that need to enter the
 * generation workflow without running the routing and canonical-title AI tasks.
 */
export async function courseStartRequestFixture(attrs?: Partial<CourseStartRequest>) {
  return prisma.courseStartRequest.create({ data: courseStartRequestAttrs(attrs) });
}

/**
 * Creates a request that is valid input for the course-generation workflow.
 * Routing can also persist unsupported requests with no title or generation
 * status, so workflow tests use this helper when they need the non-null subset.
 */
export async function generatableCourseStartRequestFixture(
  attrs?: Partial<CourseStartRequest>,
): Promise<GeneratableCourseStartRequest> {
  const request = await courseStartRequestFixture(attrs);
  const { canonicalTitle, generationStatus } = request;

  if (!(canonicalTitle && generationStatus)) {
    throw new Error("Generatable course start requests need a title and generation status");
  }

  return { ...request, canonicalTitle, generationStatus };
}
