import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type ChapterSentence, type TransactionClient } from "@zoonk/db";
import { sanitizeDistractors } from "@zoonk/utils/distractors";
import { emptyToNull, normalizePunctuation } from "@zoonk/utils/string";
import { type WordMetadataEntry } from "../generate-sentence-word-metadata-step";
import { type LessonContext } from "../get-lesson-step";
import { collectTranslatedReadingWords } from "./collect-reading-target-words";
import { type ReadingLessonContent } from "./generated-lesson-content";
import { type GeneratedLessonGroup } from "./persist-generated-lesson-groups";
import { type StepRecord } from "./save-lesson-content-helpers";

type ReadingSentence = ReadingLessonContent["sentences"][number];

type ReadingGroupEntry = {
  companionLessonId: string | null;
  position: number;
  readingSentence: ReadingSentence;
  sentenceId: string;
  sourceLessonId: string;
};

export type ReadingGroupPersistenceInput = {
  context: LessonContext;
  distractors: Record<string, string[]>;
  translationDistractors: Record<string, string[]>;
  wordMetadata: Record<string, WordMetadataEntry>;
};

/** Fails before scoped writes if reusable metadata omitted a generated sentence. */
function getRequiredSentenceId({
  readingSentence,
  sentenceIds,
}: {
  readingSentence: ReadingSentence;
  sentenceIds: Record<string, string>;
}): string {
  const sentenceId = sentenceIds[normalizePunctuation(readingSentence.sentence)];

  if (!sentenceId) {
    throw new Error("Reading sentence metadata is missing");
  }

  return sentenceId;
}

/** Builds ordered persistence entries for one exact reading/listening pair. */
function getReadingGroupEntries({
  group,
  sentences,
  sentenceIds,
}: {
  group: GeneratedLessonGroup;
  sentences: ReadingSentence[];
  sentenceIds: Record<string, string>;
}): ReadingGroupEntry[] {
  return sentences.map((readingSentence, position) => ({
    companionLessonId: group.companionLesson?.id ?? null,
    position,
    readingSentence,
    sentenceId: getRequiredSentenceId({ readingSentence, sentenceIds }),
    sourceLessonId: group.sourceLesson.id,
  }));
}

/** Returns the sentence slice that must correspond to one prepared lesson group. */
function getRequiredSentenceGroup({
  groupIndex,
  sentenceGroups,
}: {
  groupIndex: number;
  sentenceGroups: ReadingSentence[][];
}): ReadingSentence[] {
  const sentences = sentenceGroups[groupIndex];

  if (!sentences) {
    throw new Error("Reading lesson group has no sentences");
  }

  return sentences;
}

/** Zips every balanced sentence slice with the lesson pair created for that slice. */
function getReadingEntries({
  groups,
  sentenceGroups,
  sentenceIds,
}: {
  groups: GeneratedLessonGroup[];
  sentenceGroups: ReadingSentence[][];
  sentenceIds: Record<string, string>;
}): ReadingGroupEntry[] {
  if (groups.length !== sentenceGroups.length) {
    throw new Error("Reading groups do not match generated sentence groups");
  }

  return groups.flatMap((group, groupIndex) =>
    getReadingGroupEntries({
      group,
      sentenceIds,
      sentences: getRequiredSentenceGroup({ groupIndex, sentenceGroups }),
    }),
  );
}

/** One source lesson and reusable sentence identify a scoped reading resource. */
function getReadingResourceKey({
  sentenceId,
  sourceLessonId,
}: Pick<ReadingGroupEntry, "sentenceId" | "sourceLessonId">): string {
  return `${sourceLessonId}:${sentenceId}`;
}

/** Converts one generated sentence into its lesson-scoped reading resource. */
function getReadingResourceData({
  chapterId,
  entry,
  params,
}: {
  chapterId: string;
  entry: ReadingGroupEntry;
  params: ReadingGroupPersistenceInput;
}) {
  const translation = normalizePunctuation(entry.readingSentence.translation);

  return {
    chapterId,
    distractors: sanitizeDistractors({
      distractors: params.distractors[entry.readingSentence.sentence] ?? [],
      input: entry.readingSentence.sentence,
      shape: "single-word",
    }),
    explanation: emptyToNull(entry.readingSentence.explanation),
    sentenceId: entry.sentenceId,
    sourceLessonId: entry.sourceLessonId,
    translation,
    translationDistractors: sanitizeDistractors({
      distractors: params.translationDistractors[entry.readingSentence.translation] ?? [],
      input: entry.readingSentence.translation,
      shape: "single-word",
    }),
    userLanguage: params.context.language,
  };
}

/** Deduplicates repeated sentences before the bulk chapter-resource insert. */
function getReadingResources({
  entries,
  params,
}: {
  entries: ReadingGroupEntry[];
  params: ReadingGroupPersistenceInput;
}) {
  const resources = entries.map(
    (entry) =>
      [
        getReadingResourceKey(entry),
        getReadingResourceData({ chapterId: params.context.chapterId, entry, params }),
      ] as const,
  );

  return [...new Map(resources).values()];
}

/** Resolves the chapter-sentence row created for one ordered reading entry. */
function getReadingResource({
  entry,
  resources,
}: {
  entry: ReadingGroupEntry;
  resources: Map<string, ChapterSentence>;
}): ChapterSentence {
  const resource = resources.get(getReadingResourceKey(entry));

  if (!resource) {
    throw new Error("Reading chapter resource was not created");
  }

  return resource;
}

/** Creates the source step and its optional listening step from one resource. */
function getReadingSteps({
  entry,
  resource,
}: {
  entry: ReadingGroupEntry;
  resource: ChapterSentence;
}): StepRecord[] {
  const readingStep = {
    chapterSentenceId: resource.id,
    content: assertStepContent("reading", {}),
    isPublished: true,
    kind: "reading" as const,
    lessonId: entry.sourceLessonId,
    position: entry.position,
    sentenceId: entry.sentenceId,
  };

  if (!entry.companionLessonId) {
    return [readingStep];
  }

  return [
    readingStep,
    {
      chapterSentenceId: resource.id,
      content: assertStepContent("listening", {}),
      isPublished: true,
      kind: "listening",
      lessonId: entry.companionLessonId,
      position: entry.position,
      sentenceId: entry.sentenceId,
    },
  ];
}

/** Fails before chapter-word creation if one reusable word was not saved. */
function getRequiredReadingWordId({
  word,
  wordIds,
}: {
  word: string;
  wordIds: Record<string, string>;
}): string {
  const wordId = wordIds[word];

  if (!wordId) {
    throw new Error(`Reading word metadata is missing for ${word}`);
  }

  return wordId;
}

/** Builds canonical word translation rows for one split reading lesson. */
function getReadingChapterWords({
  group,
  params,
  sentences,
  wordIds,
}: {
  group: GeneratedLessonGroup;
  params: ReadingGroupPersistenceInput;
  sentences: ReadingSentence[];
  wordIds: Record<string, string>;
}) {
  const translatedWords = collectTranslatedReadingWords({
    sentences,
    wordMetadata: params.wordMetadata,
  });

  return translatedWords.map((word) => ({
    chapterId: params.context.chapterId,
    distractors: [],
    sourceLessonId: group.sourceLesson.id,
    translation: params.wordMetadata[word]?.translation ?? "",
    userLanguage: params.context.language,
    wordId: getRequiredReadingWordId({ word, wordIds }),
  }));
}

/** Bulk-inserts canonical word translations only when the reading has words. */
async function saveReadingChapterWords({
  groups,
  params,
  sentenceGroups,
  transaction,
  wordIds,
}: {
  groups: GeneratedLessonGroup[];
  params: ReadingGroupPersistenceInput;
  sentenceGroups: ReadingSentence[][];
  transaction: TransactionClient;
  wordIds: Record<string, string>;
}): Promise<void> {
  const data = groups.flatMap((group, groupIndex) =>
    getReadingChapterWords({
      group,
      params,
      sentences: getRequiredSentenceGroup({ groupIndex, sentenceGroups }),
      wordIds,
    }),
  );

  if (data.length > 0) {
    await transaction.chapterWord.createMany({ data });
  }
}

/**
 * Bulk-writes lesson-scoped sentence/word resources and paired steps while the
 * chapter order is locked. Query count stays constant as AI output grows.
 */
export async function persistReadingGroups({
  groups,
  params,
  sentenceGroups,
  sentenceIds,
  transaction,
  wordIds,
}: {
  groups: GeneratedLessonGroup[];
  params: ReadingGroupPersistenceInput;
  sentenceGroups: ReadingSentence[][];
  sentenceIds: Record<string, string>;
  transaction: TransactionClient;
  wordIds: Record<string, string>;
}): Promise<void> {
  const entries = getReadingEntries({ groups, sentenceGroups, sentenceIds });
  const sourceLessonIds = groups.map((group) => group.sourceLesson.id);

  const lessonIds = groups.flatMap((group) => [
    group.sourceLesson.id,
    ...(group.companionLesson ? [group.companionLesson.id] : []),
  ]);

  await Promise.all([
    transaction.step.deleteMany({ where: { lessonId: { in: lessonIds } } }),
    transaction.chapterSentence.deleteMany({ where: { sourceLessonId: { in: sourceLessonIds } } }),
    transaction.chapterWord.deleteMany({ where: { sourceLessonId: { in: sourceLessonIds } } }),
  ]);

  await saveReadingChapterWords({ groups, params, sentenceGroups, transaction, wordIds });

  const chapterSentences = await transaction.chapterSentence.createManyAndReturn({
    data: getReadingResources({ entries, params }),
  });

  const resources = new Map(
    chapterSentences.map((resource) => [getReadingResourceKey(resource), resource]),
  );

  const steps = entries.flatMap((entry) =>
    getReadingSteps({ entry, resource: getReadingResource({ entry, resources }) }),
  );

  await transaction.step.createMany({ data: steps });
}
