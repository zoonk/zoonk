import { generateAlphabetAudioStep } from "../steps/generate-alphabet-audio-step";
import { generateAlphabetContentStep } from "../steps/generate-alphabet-content-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { saveAlphabetLessonStep } from "../steps/save-alphabet-lesson-step";

/**
 * Alphabet lesson generation writes the focused lesson content first, then adds
 * media enrichment and saves the player-facing steps.
 */
export async function alphabetLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  const content = await generateAlphabetContentStep(context);

  const { audioUrls } = await generateAlphabetAudioStep({ context, symbols: content.symbols });

  await saveAlphabetLessonStep({ audioUrls, content, context });
}
