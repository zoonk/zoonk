import "server-only";
import { type LanguageLessonContent } from "@zoonk/ai/tasks/language/language-lesson";
import { prisma } from "@zoonk/db";
import { normalizeWordKey } from "../../../player/contracts/build-word-bank-options";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";

type SharedVocabularyInput = {
  content: LanguageLessonContent;
  learnerLanguage: string;
  organizationId: string;
  provenance: LibraryProvenance;
  targetLanguage: string;
};

export type SharedVocabulary = {
  wordIdsByText: Map<string, string>;
  sentenceIdsByText: Map<string, string>;
};

type TargetWordsInput = {
  organizationId: string;
  provenance: LibraryProvenance;
  romanizations?: ReadonlyMap<string, string | null>;
  targetLanguage: string;
  texts: readonly string[];
};

function findWords({
  organizationId,
  targetLanguage,
  texts,
}: Pick<TargetWordsInput, "organizationId" | "targetLanguage" | "texts">) {
  return prisma.word.findMany({
    orderBy: { createdAt: "asc" },
    where: { organizationId, targetLanguage, word: { in: [...texts], mode: "insensitive" } },
  });
}

type WordRow = Awaited<ReturnType<typeof findWords>>[number];

function uniqueByKey(texts: readonly string[]): string[] {
  const byKey = texts.reduce((unique, text) => {
    const key = normalizeWordKey(text);
    return unique.has(key) ? unique : unique.set(key, text);
  }, new Map<string, string>());

  return [...byKey.values()];
}

function pickRowByKey(rows: WordRow[]): Map<string, WordRow> {
  return rows.reduce((picked, row) => {
    const key = normalizeWordKey(row.word);
    const current = picked.get(key);
    return !current || (!current.audioUrl && row.audioUrl) ? picked.set(key, row) : picked;
  }, new Map<string, WordRow>());
}

/**
 * Maps each text to its shared Word row, reusing one that differs only in case (a voiced one
 * first), so the same word is never stored or voiced twice.
 */
export async function saveTargetWords({
  organizationId,
  provenance,
  romanizations = new Map(),
  targetLanguage,
  texts,
}: TargetWordsInput): Promise<Map<string, string>> {
  const written = toProvenanceData(provenance);

  const romanizationByKey = new Map(
    [...romanizations].map(([text, romanization]) => [normalizeWordKey(text), romanization]),
  );

  const existing = await findWords({ organizationId, targetLanguage, texts });
  const existingKeys = new Set(existing.map((row) => normalizeWordKey(row.word)));

  await prisma.word.createMany({
    data: uniqueByKey(texts)
      .filter((word) => !existingKeys.has(normalizeWordKey(word)))
      .map((word) => ({
        ...written,
        organizationId,
        romanization: romanizationByKey.get(normalizeWordKey(word)) ?? null,
        targetLanguage,
        word,
      })),
    skipDuplicates: true,
  });

  const rows = pickRowByKey(await findWords({ organizationId, targetLanguage, texts }));

  await Promise.all(
    [...rows].flatMap(([key, row]) => {
      const romanization = romanizationByKey.get(key);

      return !row.romanization && romanization
        ? [
            prisma.word.updateMany({
              data: { ...written, romanization },
              where: { id: row.id, romanization: null },
            }),
          ]
        : [];
    }),
  );

  return new Map(
    texts.flatMap((text) => {
      const row = rows.get(normalizeWordKey(text));
      return row ? [[text, row.id]] : [];
    }),
  );
}

function saveWords({ content, organizationId, provenance, targetLanguage }: SharedVocabularyInput) {
  return saveTargetWords({
    organizationId,
    provenance,
    romanizations: new Map(content.words.map((word) => [word.word, word.romanization])),
    targetLanguage,
    texts: content.words.flatMap((word) => [word.word, ...word.distractors]),
  });
}

async function savePronunciations({
  content,
  learnerLanguage,
  provenance,
  wordIdsByText,
}: {
  content: LanguageLessonContent;
  learnerLanguage: string;
  provenance: LibraryProvenance;
  wordIdsByText: ReadonlyMap<string, string>;
}) {
  const written = toProvenanceData(provenance);

  const guides = content.words.flatMap((word) => {
    const wordId = wordIdsByText.get(word.word);
    return wordId && word.pronunciation ? [{ ...word, wordId }] : [];
  });

  await prisma.wordPronunciation.createMany({
    data: guides.map((guide) => ({
      ...written,
      pronunciation: guide.pronunciation,
      tip: guide.tip,
      userLanguage: learnerLanguage,
      wordId: guide.wordId,
    })),
    skipDuplicates: true,
  });

  await Promise.all(
    guides.flatMap((guide) =>
      guide.tip
        ? [
            prisma.wordPronunciation.updateMany({
              data: { ...written, tip: guide.tip },
              where: { tip: null, userLanguage: learnerLanguage, wordId: guide.wordId },
            }),
          ]
        : [],
    ),
  );
}

async function saveSentences({
  content,
  organizationId,
  provenance,
  targetLanguage,
}: SharedVocabularyInput) {
  const written = toProvenanceData(provenance);

  const romanizations = new Map(
    content.sentences.map((sentence) => [sentence.sentence, sentence.romanization]),
  );

  const texts = content.sentences.map((sentence) => sentence.sentence);

  await prisma.sentence.createMany({
    data: texts.map((sentence) => ({
      ...written,
      organizationId,
      romanization: romanizations.get(sentence) ?? null,
      sentence,
      targetLanguage,
    })),
    skipDuplicates: true,
  });

  const rows = await prisma.sentence.findMany({
    where: { organizationId, sentence: { in: texts }, targetLanguage },
  });

  await Promise.all(
    rows.flatMap((row) => {
      const romanization = romanizations.get(row.sentence);

      return !row.romanization && romanization
        ? [
            prisma.sentence.updateMany({
              data: { ...written, romanization },
              where: { id: row.id, romanization: null },
            }),
          ]
        : [];
    }),
  );

  return new Map(rows.map((row) => [row.sentence, row.id]));
}

export async function saveSharedVocabulary(
  input: SharedVocabularyInput,
): Promise<SharedVocabulary> {
  const [wordIdsByText, sentenceIdsByText] = await Promise.all([
    saveWords(input),
    saveSentences(input),
  ]);

  await savePronunciations({
    content: input.content,
    learnerLanguage: input.learnerLanguage,
    provenance: input.provenance,
    wordIdsByText,
  });

  return { sentenceIdsByText, wordIdsByText };
}
