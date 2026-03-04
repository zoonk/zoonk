import { type VocabularyWord } from "@zoonk/ai/tasks/activities/language/vocabulary";
import { completeActivityStep } from "../steps/complete-activity-step";
import { generateReadingAudioStep } from "../steps/generate-reading-audio-step";
import { generateReadingContentStep } from "../steps/generate-reading-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { saveReadingSentencesStep } from "../steps/save-reading-sentences-step";
import { updateReadingEnrichmentsStep } from "../steps/update-reading-enrichments-step";

export async function readingActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  words: VocabularyWord[],
  concepts: string[],
  neighboringConcepts: string[],
): Promise<void> {
  "use workflow";

  const currentRunWords = words.map((word) => word.word);

  const { sentences } = await generateReadingContentStep(
    activities,
    workflowRunId,
    currentRunWords,
    concepts,
    neighboringConcepts,
  );

  const { savedSentences } = await saveReadingSentencesStep(activities, sentences);

  const { audioUrls } = await generateReadingAudioStep(activities, savedSentences);
  await updateReadingEnrichmentsStep(activities, savedSentences, audioUrls);
  await completeActivityStep(activities, workflowRunId, "reading");
}
