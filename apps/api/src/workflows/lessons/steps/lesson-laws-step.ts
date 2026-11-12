import { type LessonLaw, generateLessonLaws } from "@zoonk/ai/tasks/lesson-laws";
import {
  type FoundLessonLaw,
  type LessonLawsPrompt,
  linkLessonLaws,
  loadLessonLawsInput,
  replanUnsourcedLesson,
} from "@zoonk/core/library/lessons/laws";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

export type NamedLessonLaws = { laws: LessonLaw[]; prompt: LessonLawsPrompt };

/** Null for a lesson that never reads laws or already has them. */
export async function nameLessonLawsStep({
  analytics,
  lessonId,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  lessonId: string;
  workflowRunId: string;
}): Promise<NamedLessonLaws | null> {
  "use step";

  const input = await loadLessonLawsInput(lessonId);

  if (!input) {
    return null;
  }

  const { data } = await generateLessonLaws({
    ...input.prompt,
    analytics: toContentAnalytics({ analytics, scope: input, workflowRunId }),
  });

  return { laws: data.laws, prompt: input.prompt };
}

export async function replanUnsourcedLessonStep(lessonId: string): Promise<void> {
  "use step";

  await replanUnsourcedLesson(lessonId);
}

export async function linkLessonLawsStep({
  found,
  lessonId,
  prompt,
}: {
  found: FoundLessonLaw[];
  lessonId: string;
  prompt: LessonLawsPrompt;
}): Promise<void> {
  "use step";

  await linkLessonLaws({ laws: found, lessonId, prompt });
  await replanUnsourcedLesson(lessonId);
}
