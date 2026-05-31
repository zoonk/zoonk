import { collectReadingTargetWords } from "../steps/_utils/collect-reading-target-words";
import { generateReadingAudioStep } from "../steps/generate-reading-audio-step";
import { generateReadingContentStep } from "../steps/generate-reading-content-step";
import { generateReadingRomanizationStep } from "../steps/generate-reading-romanization-step";
import { generateSentenceDistractorsStep } from "../steps/generate-sentence-distractors-step";
import { generateSentenceWordAudioStep } from "../steps/generate-sentence-word-audio-step";
import { generateSentenceWordMetadataStep } from "../steps/generate-sentence-word-metadata-step";
import { generateSentenceWordPronunciationStep } from "../steps/generate-sentence-word-pronunciation-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { saveListeningLessonStep } from "../steps/save-listening-lesson-step";
import { saveReadingLessonStep } from "../steps/save-reading-lesson-step";

/**
 * Reading generation is bounded by the previous reading lesson so each reading
 * lesson follows the vocabulary metadata group immediately before it without
 * depending on generated vocabulary rows.
 */
export async function readingLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  const content = await generateReadingContentStep(context);

  const [{ sentenceAudioUrls }, { romanizations: sentenceRomanizations }] = await Promise.all([
    generateReadingAudioStep({ context, sentences: content.sentences }),
    generateReadingRomanizationStep({ context, sentences: content.sentences }),
  ]);

  const { distractors, translationDistractors } = await generateSentenceDistractorsStep({
    context,
    sentences: content.sentences,
  });

  const targetWords = collectReadingTargetWords({ distractors, sentences: content.sentences });

  const { wordMetadata } = await generateSentenceWordMetadataStep({
    context,
    sentences: content.sentences,
    targetWords,
  });

  const [{ wordAudioUrls }, { pronunciations }] = await Promise.all([
    generateSentenceWordAudioStep({ context, words: targetWords }),
    generateSentenceWordPronunciationStep({ context, words: targetWords }),
  ]);

  await saveReadingLessonStep({
    context,
    distractors,
    pronunciations,
    sentenceAudioUrls,
    sentenceRomanizations,
    sentences: content.sentences,
    translationDistractors,
    wordAudioUrls,
    wordMetadata,
  });

  await saveListeningLessonStep(context);
}
