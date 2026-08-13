import { generateAlphabetAudio } from "../steps/generate-alphabet-audio";
import { generateAlphabetContentStep } from "../steps/generate-alphabet-content-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { saveAlphabetLessonStep } from "../steps/save-alphabet-lesson-step";

/**
 * Alphabet lesson generation enriches the full AI result once, then saves each
 * balanced symbol group directly to its final lesson row.
 */
export async function alphabetLessonWorkflow({
  context,
  workflowRunId,
}: {
  context: LessonContext;
  workflowRunId: string;
}): Promise<void> {
  "use workflow";

  const content = await generateAlphabetContentStep(context);

  const { audioUrls } = await generateAlphabetAudio({ context, symbols: content.symbols });

  await saveAlphabetLessonStep({ audioUrls, content, context, workflowRunId });
}
