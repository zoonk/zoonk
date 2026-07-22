import { createStepStream } from "@/workflows/_shared/stream-status";
import { getCoursePromptGenerationError } from "@zoonk/core/courses/prompt-generation";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CoursePrompt, type GenerationStatus, prisma } from "@zoonk/db";
import { FatalError } from "workflow";

type GeneratableCoursePromptBase = CoursePrompt & {
  canonicalTitle: string;
  generationStatus: GenerationStatus;
  intent: "learn";
};

export type GeneratableCoursePrompt =
  | (GeneratableCoursePromptBase & { courseFormat: "core"; targetLanguage: null })
  | (GeneratableCoursePromptBase & { courseFormat: "language"; targetLanguage: string });

/**
 * Narrows persisted routing decisions to the subset the course workflow can
 * generate today. Redirect-only, waitlist, and unsafe prompts are valid admin
 * records but invalid workflow inputs.
 */
export function assertGeneratableCoursePrompt(
  prompt: CoursePrompt,
): asserts prompt is GeneratableCoursePrompt {
  const generationError = getCoursePromptGenerationError(prompt);

  if (generationError) {
    throw new FatalError(generationError);
  }
}

/**
 * Loads and narrows the durable prompt without treating its status snapshot as
 * generation ownership. The workflow reconciles the linked course under a row
 * lock because a same-run retry may legitimately read this prompt as running.
 */
export async function getCoursePromptStep(
  coursePromptId: string,
): Promise<GeneratableCoursePrompt> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "getCoursePrompt" });

  const prompt = await prisma.coursePrompt.findUnique({ where: { id: coursePromptId } });

  if (!prompt) {
    await stream.error({ reason: "notFound", step: "getCoursePrompt" });
    throw new FatalError("Course prompt not found");
  }

  assertGeneratableCoursePrompt(prompt);

  await stream.status({ status: "completed", step: "getCoursePrompt" });
  return prompt;
}
