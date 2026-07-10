import { randomUUID } from "node:crypto";
import { type CoursePrompt, type GenerationStatus, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";

type GeneratableCoursePrompt = CoursePrompt & {
  canonicalTitle: string;
  generationStatus: GenerationStatus;
};

/**
 * Builds a complete prompt row with the supported learn-core defaults used
 * by most generation tests, while still allowing each test to override the
 * routing decision it needs to exercise.
 */
function coursePromptAttrs(
  attrs?: Partial<CoursePrompt>,
): Omit<CoursePrompt, "id" | "createdAt" | "updatedAt"> {
  const canonicalTitle = attrs?.canonicalTitle ?? `Test Course Request ${randomUUID()}`;
  const prompt = attrs?.prompt ?? `${canonicalTitle} ${randomUUID()}`;

  return {
    canonicalTitle,
    courseFormat: "core",
    courseId: null,
    generationRunId: null,
    generationStatus: "pending",
    intent: "learn",
    language: "en",
    normalizedPrompt: normalizeString(prompt),
    prompt,
    targetLanguage: null,
    ...attrs,
  };
}

/**
 * Creates a durable course prompt for tests that need to enter the
 * generation workflow without running the routing and canonical-title AI tasks.
 */
export async function coursePromptFixture(attrs?: Partial<CoursePrompt>) {
  return prisma.coursePrompt.create({ data: coursePromptAttrs(attrs) });
}

/**
 * Creates a prompt that is valid input for the course-generation workflow.
 * Routing can also persist unsupported requests with no title or generation
 * status, so workflow tests use this helper when they need the non-null subset.
 */
export async function generatableCoursePromptFixture(
  attrs?: Partial<CoursePrompt>,
): Promise<GeneratableCoursePrompt> {
  const prompt = await coursePromptFixture(attrs);
  const { canonicalTitle, generationStatus } = prompt;

  if (!(canonicalTitle && generationStatus)) {
    throw new Error("Generatable course prompts need a title and generation status");
  }

  return { ...prompt, canonicalTitle, generationStatus };
}
