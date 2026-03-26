import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { settled } from "@zoonk/utils/settled";
import { generateVocabularyAudioStep } from "../steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "../steps/generate-vocabulary-content-step";
import { generateVocabularyPronunciationAndAlternativesStep } from "../steps/generate-vocabulary-pronunciation-and-alternatives-step";
import { generateVocabularyRomanizationStep } from "../steps/generate-vocabulary-romanization-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveVocabularyActivityStep } from "../steps/save-vocabulary-activity-step";

export async function vocabularyActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<{ words: VocabularyWord[] }> {
  "use workflow";

  const { words } = await generateVocabularyContentStep(
    activities,
    workflowRunId,
    concepts,
    neighboringConcepts,
  );

  const [pronunciationAndAltsResult, audioResult, romanizationResult] = await Promise.allSettled([
    generateVocabularyPronunciationAndAlternativesStep(activities, words),
    generateVocabularyAudioStep(activities, words),
    generateVocabularyRomanizationStep(activities, words),
  ]);

  const { alternatives, pronunciations } = settled(pronunciationAndAltsResult, {
    alternatives: {},
    pronunciations: {},
  });
  const { wordAudioUrls } = settled(audioResult, { wordAudioUrls: {} });
  const { romanizations } = settled(romanizationResult, { romanizations: {} });

  await saveVocabularyActivityStep({
    activities,
    alternatives,
    pronunciations,
    romanizations,
    wordAudioUrls,
    words,
    workflowRunId,
  });

  return { words };
}
