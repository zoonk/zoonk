import { createStepStream } from "@/workflows/_shared/stream-status";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { normalizePunctuation } from "@zoonk/utils/string";
import { deduplicateGeneratedItems } from "./_utils/deduplicate-generated-items";
import { type ReadingLessonContent } from "./_utils/generated-lesson-content";
import { persistGeneratedLessonGroups } from "./_utils/persist-generated-lesson-groups";
import {
  type ReadingGroupPersistenceInput,
  persistReadingGroups,
} from "./_utils/persist-reading-groups";
import { saveGeneratedSentenceMetadata } from "./_utils/save-generated-sentence-metadata";
import { saveReadingWordMetadata } from "./_utils/save-reading-target-words";
import { splitLessonItems } from "./_utils/split-lesson-items";

type ReadingSentence = ReadingLessonContent["sentences"][number];

type SaveReadingLessonInput = ReadingGroupPersistenceInput & {
  pronunciations: Record<string, string>;
  sentenceAudioUrls: Record<string, string>;
  sentenceRomanizations: Record<string, string>;
  sentences: ReadingSentence[];
  wordAudioUrls: Record<string, string>;
  workflowRunId: string;
};

/**
 * Reading persistence saves reusable sentence and word metadata first, then one
 * short transaction creates every balanced reading/listening lesson pair.
 */
export async function saveReadingLessonStep(params: SaveReadingLessonInput): Promise<void> {
  "use step";

  const course = params.context.chapter.course;

  if (params.sentences.length === 0) {
    throw new Error("Reading save step received no sentences");
  }

  if (!course.organization || !course.targetLanguage) {
    throw new Error("Reading save step needs course language and organization data");
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveReadingLesson" });

  const sentences = deduplicateGeneratedItems({
    getKey: (entry) => normalizePunctuation(entry.sentence).trim().toLowerCase(),
    items: params.sentences,
  });

  const sentenceGroups = splitLessonItems(sentences);

  const [wordIds, sentenceIds] = await Promise.all([
    saveReadingWordMetadata({
      distractors: params.distractors,
      organizationId: course.organization.id,
      pronunciations: params.pronunciations,
      sentences,
      targetLanguage: course.targetLanguage,
      userLanguage: params.context.language,
      wordAudioUrls: params.wordAudioUrls,
      wordMetadata: params.wordMetadata,
    }),
    saveGeneratedSentenceMetadata({
      organizationId: course.organization.id,
      sentenceAudioUrls: params.sentenceAudioUrls,
      sentenceRomanizations: params.sentenceRomanizations,
      sentences,
      targetLanguage: course.targetLanguage,
    }),
  ]);

  await persistGeneratedLessonGroups({
    chapterId: params.context.chapterId,
    groupCount: sentenceGroups.length,
    lessonId: params.context.id,
    persistGroups: ({ groups, transaction }) =>
      persistReadingGroups({ groups, params, sentenceGroups, sentenceIds, transaction, wordIds }),
    workflowRunId: params.workflowRunId,
  });

  await stream.status({ status: "completed", step: "saveReadingLesson" });
}
