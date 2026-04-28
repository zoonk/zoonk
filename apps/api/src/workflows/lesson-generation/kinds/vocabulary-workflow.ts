import { deduplicateNormalizedTexts } from "@zoonk/utils/string";
import { generateVocabularyAudioStep } from "../steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "../steps/generate-vocabulary-content-step";
import { generateVocabularyDistractorsStep } from "../steps/generate-vocabulary-distractors-step";
import { generateVocabularyPronunciationStep } from "../steps/generate-vocabulary-pronunciation-step";
import { generateVocabularyRomanizationStep } from "../steps/generate-vocabulary-romanization-step";
import { type LessonContext } from "../steps/get-lesson-step";
import { saveVocabularyLessonStep } from "../steps/save-vocabulary-lesson-step";

function collectVocabularyTargetWords({
  distractors,
  words,
}: {
  distractors: Record<string, string[]>;
  words: { word: string }[];
}): string[] {
  return deduplicateNormalizedTexts([
    ...words.map((entry) => entry.word),
    ...words.flatMap((entry) => distractors[entry.word] ?? []),
  ]);
}

export async function vocabularyLessonWorkflow(context: LessonContext): Promise<void> {
  "use workflow";

  const content = await generateVocabularyContentStep(context);
  const { distractors } = await generateVocabularyDistractorsStep({
    context,
    words: content.words,
  });
  const vocabularyTargetWords = collectVocabularyTargetWords({
    distractors,
    words: content.words,
  });

  const [{ pronunciations }, { wordAudioUrls }, { romanizations }] = await Promise.all([
    generateVocabularyPronunciationStep({ context, words: vocabularyTargetWords }),
    generateVocabularyAudioStep({ context, words: vocabularyTargetWords }),
    generateVocabularyRomanizationStep({ context, words: vocabularyTargetWords }),
  ]);

  await saveVocabularyLessonStep({
    context,
    distractors,
    pronunciations,
    romanizations,
    wordAudioUrls,
    words: content.words,
  });
}
