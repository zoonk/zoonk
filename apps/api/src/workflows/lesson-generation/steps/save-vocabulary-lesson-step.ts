import { createStepStream } from "@/workflows/_shared/stream-status";
import { type VocabularyWord } from "@zoonk/ai/tasks/lessons/language/vocabulary";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type ChapterWord, type TransactionClient } from "@zoonk/db";
import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { normalizePunctuation } from "@zoonk/utils/string";
import { collectVocabularyTargetWords } from "./_utils/collect-vocabulary-target-words";
import {
  type GeneratedLessonGroup,
  persistGeneratedLessonGroups,
} from "./_utils/persist-generated-lesson-groups";
import {
  type GeneratedWordMetadata,
  saveGeneratedWordMetadata,
} from "./_utils/save-generated-word-metadata";
import { type StepRecord } from "./_utils/save-lesson-content-helpers";
import { splitLessonItems } from "./_utils/split-lesson-items";
import { type LessonContext } from "./get-lesson-step";

type VocabularyGroupEntry = {
  companionLessonId: string | null;
  position: number;
  sourceLessonId: string;
  word: VocabularyWord;
  wordId: string;
};

/**
 * Vocabulary persistence saves reusable word metadata before one short atomic
 * write creates every balanced vocabulary/translation lesson pair.
 */
export async function saveVocabularyLessonStep({
  context,
  distractors,
  pronunciations,
  romanizations,
  wordAudioUrls,
  words,
  workflowRunId,
}: {
  context: LessonContext;
  distractors: Record<string, string[]>;
  pronunciations: Record<string, string>;
  romanizations: Record<string, string>;
  wordAudioUrls: Record<string, string>;
  words: VocabularyWord[];
  workflowRunId: string;
}): Promise<void> {
  "use step";

  if (words.length === 0) {
    throw new Error("Vocabulary save step received no words");
  }

  const course = context.chapter.course;

  if (!course.organization || !course.targetLanguage) {
    throw new Error("Vocabulary save step needs course language and organization data");
  }

  await using stream = createStepStream<LessonStepName>();
  await stream.status({ status: "started", step: "saveVocabularyLesson" });

  const wordGroups = splitLessonItems(words);
  const allTargetWords = collectVocabularyTargetWords({ distractors, words });
  const wordsToSave = [...new Set([...words.map((entry) => entry.word), ...allTargetWords])];

  const wordIds = await saveGeneratedWordMetadata({
    organizationId: course.organization.id,
    targetLanguage: course.targetLanguage,
    userLanguage: context.language,
    words: wordsToSave.map((word) =>
      getVocabularyWordMetadata({ pronunciations, romanizations, word, wordAudioUrls }),
    ),
  });

  await persistGeneratedLessonGroups({
    chapterId: context.chapterId,
    groupCount: wordGroups.length,
    lessonId: context.id,
    persistGroups: ({ groups, transaction }) =>
      persistVocabularyGroups({ context, distractors, groups, transaction, wordGroups, wordIds }),
    workflowRunId,
  });

  await stream.status({ status: "completed", step: "saveVocabularyLesson" });
}

/**
 * Converts one enriched target word into reusable metadata. Canonical words and
 * distractors share the same global Word and pronunciation representation.
 */
function getVocabularyWordMetadata({
  pronunciations,
  romanizations,
  word,
  wordAudioUrls,
}: {
  pronunciations: Record<string, string>;
  romanizations: Record<string, string>;
  word: string;
  wordAudioUrls: Record<string, string>;
}): GeneratedWordMetadata {
  const romanization = romanizations[word] ?? null;

  return {
    audioUrl: wordAudioUrls[word] ?? null,
    pronunciation: pronunciations[word] ?? null,
    romanization,
    romanizationUpdate: romanization ? { romanization } : {},
    word,
  };
}

/** Fails before scoped writes if reusable metadata omitted a canonical word. */
function getRequiredWordId({
  word,
  wordIds,
}: {
  word: string;
  wordIds: Record<string, string>;
}): string {
  const wordId = wordIds[word];

  if (!wordId) {
    throw new Error(`Vocabulary word metadata is missing for ${word}`);
  }

  return wordId;
}

/** Builds ordered persistence entries for one exact vocabulary/translation pair. */
function getVocabularyGroupEntries({
  group,
  words,
  wordIds,
}: {
  group: GeneratedLessonGroup;
  words: VocabularyWord[];
  wordIds: Record<string, string>;
}): VocabularyGroupEntry[] {
  return words.map((word, position) => ({
    companionLessonId: group.companionLesson?.id ?? null,
    position,
    sourceLessonId: group.sourceLesson.id,
    word,
    wordId: getRequiredWordId({ word: word.word, wordIds }),
  }));
}

/** Returns the word slice that must correspond to one prepared lesson group. */
function getRequiredWordGroup({
  groupIndex,
  wordGroups,
}: {
  groupIndex: number;
  wordGroups: VocabularyWord[][];
}): VocabularyWord[] {
  const words = wordGroups[groupIndex];

  if (!words) {
    throw new Error("Vocabulary lesson group has no words");
  }

  return words;
}

/** Zips every balanced word slice with the lesson pair created for that slice. */
function getVocabularyEntries({
  groups,
  wordGroups,
  wordIds,
}: {
  groups: GeneratedLessonGroup[];
  wordGroups: VocabularyWord[][];
  wordIds: Record<string, string>;
}): VocabularyGroupEntry[] {
  if (groups.length !== wordGroups.length) {
    throw new Error("Vocabulary groups do not match generated word groups");
  }

  return groups.flatMap((group, groupIndex) =>
    getVocabularyGroupEntries({
      group,
      wordIds,
      words: getRequiredWordGroup({ groupIndex, wordGroups }),
    }),
  );
}

/** One chapter-word row is shared by vocabulary and translation steps. */
function getVocabularyResourceKey({
  sourceLessonId,
  wordId,
}: Pick<VocabularyGroupEntry, "sourceLessonId" | "wordId">): string {
  return `${sourceLessonId}:${wordId}`;
}

/** Converts one generated word into its lesson-scoped translation resource. */
function getVocabularyResourceData({
  chapterId,
  distractors,
  entry,
  userLanguage,
}: {
  chapterId: string;
  distractors: Record<string, string[]>;
  entry: VocabularyGroupEntry;
  userLanguage: string;
}) {
  return {
    chapterId,
    distractors: sanitizeDistractors({
      distractors: distractors[entry.word.word] ?? [],
      input: entry.word.word,
      shape: "any",
    }),
    sourceLessonId: entry.sourceLessonId,
    translation: normalizePunctuation(entry.word.translation),
    userLanguage,
    wordId: entry.wordId,
  };
}

/** Deduplicates repeated generated words before the bulk chapter-resource insert. */
function getVocabularyResources({
  chapterId,
  distractors,
  entries,
  userLanguage,
}: {
  chapterId: string;
  distractors: Record<string, string[]>;
  entries: VocabularyGroupEntry[];
  userLanguage: string;
}) {
  const resources = entries.map(
    (entry) =>
      [
        getVocabularyResourceKey(entry),
        getVocabularyResourceData({ chapterId, distractors, entry, userLanguage }),
      ] as const,
  );

  return [...new Map(resources).values()];
}

/** Resolves the chapter-word row created for one ordered vocabulary entry. */
function getVocabularyResource({
  entry,
  resources,
}: {
  entry: VocabularyGroupEntry;
  resources: Map<string, ChapterWord>;
}): ChapterWord {
  const resource = resources.get(getVocabularyResourceKey(entry));

  if (!resource) {
    throw new Error("Vocabulary chapter resource was not created");
  }

  return resource;
}

/** Creates the source step and its optional translation step from one resource. */
function getVocabularySteps({
  entry,
  resource,
}: {
  entry: VocabularyGroupEntry;
  resource: ChapterWord;
}): StepRecord[] {
  const vocabularyStep = {
    chapterWordId: resource.id,
    content: assertStepContent("vocabulary", {}),
    isPublished: true,
    kind: "vocabulary" as const,
    lessonId: entry.sourceLessonId,
    position: entry.position,
    wordId: entry.wordId,
  };

  if (!entry.companionLessonId) {
    return [vocabularyStep];
  }

  return [
    vocabularyStep,
    {
      chapterWordId: resource.id,
      content: assertStepContent("translation", {}),
      isPublished: true,
      kind: "translation",
      lessonId: entry.companionLessonId,
      position: entry.position,
      wordId: entry.wordId,
    },
  ];
}

/**
 * Bulk-writes lesson-scoped vocabulary resources and paired steps while the
 * chapter order is locked. Query count stays constant as AI output grows.
 */
async function persistVocabularyGroups({
  context,
  distractors,
  groups,
  transaction,
  wordGroups,
  wordIds,
}: {
  context: LessonContext;
  distractors: Record<string, string[]>;
  groups: GeneratedLessonGroup[];
  transaction: TransactionClient;
  wordGroups: VocabularyWord[][];
  wordIds: Record<string, string>;
}): Promise<void> {
  const entries = getVocabularyEntries({ groups, wordGroups, wordIds });
  const sourceLessonIds = groups.map((group) => group.sourceLesson.id);

  const lessonIds = groups.flatMap((group) => [
    group.sourceLesson.id,
    ...(group.companionLesson ? [group.companionLesson.id] : []),
  ]);

  await Promise.all([
    transaction.step.deleteMany({ where: { lessonId: { in: lessonIds } } }),
    transaction.chapterWord.deleteMany({ where: { sourceLessonId: { in: sourceLessonIds } } }),
  ]);

  const chapterWords = await transaction.chapterWord.createManyAndReturn({
    data: getVocabularyResources({
      chapterId: context.chapterId,
      distractors,
      entries,
      userLanguage: context.language,
    }),
  });

  const resources = new Map(
    chapterWords.map((resource) => [getVocabularyResourceKey(resource), resource]),
  );

  const steps = entries.flatMap((entry) =>
    getVocabularySteps({ entry, resource: getVocabularyResource({ entry, resources }) }),
  );

  await transaction.step.createMany({ data: steps });
}
