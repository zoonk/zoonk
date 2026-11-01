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

type BankWordsInput = {
  organizationId: string;
  provenance: LibraryProvenance;
  targetLanguage: string;
  texts: readonly string[];
};

function findBankWords({
  organizationId,
  targetLanguage,
  texts,
}: Omit<BankWordsInput, "provenance">) {
  return prisma.word.findMany({
    orderBy: { createdAt: "asc" },
    where: { organizationId, targetLanguage, word: { in: [...texts], mode: "insensitive" } },
  });
}

type WordRow = Awaited<ReturnType<typeof findBankWords>>[number];

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
 * A tile shows its own text and only borrows its row's audio, so a bank word reuses a row that
 * differs only in case (a voiced one first). Lesson words keep rows of their exact text instead:
 * their screens show the row's text, and German "Sie" isn't "sie".
 */
export async function saveBankWords({
  organizationId,
  provenance,
  targetLanguage,
  texts,
}: BankWordsInput): Promise<Map<string, string>> {
  const existing = await findBankWords({ organizationId, targetLanguage, texts });
  const existingKeys = new Set(existing.map((row) => normalizeWordKey(row.word)));

  await prisma.word.createMany({
    data: uniqueByKey(texts)
      .filter((word) => !existingKeys.has(normalizeWordKey(word)))
      .map((word) => ({ ...toProvenanceData(provenance), organizationId, targetLanguage, word })),
    skipDuplicates: true,
  });

  const rows = pickRowByKey(await findBankWords({ organizationId, targetLanguage, texts }));

  return new Map(
    texts.flatMap((text) => {
      const row = rows.get(normalizeWordKey(text));
      return row ? [[text, row.id]] : [];
    }),
  );
}

async function saveWords({
  content,
  organizationId,
  provenance,
  targetLanguage,
}: SharedVocabularyInput) {
  const written = toProvenanceData(provenance);
  const romanizations = new Map(content.words.map((word) => [word.word, word.romanization]));

  const texts = [...new Set(content.words.flatMap((word) => [word.word, ...word.distractors]))];

  await prisma.word.createMany({
    data: texts.map((word) => ({
      ...written,
      organizationId,
      romanization: romanizations.get(word) ?? null,
      targetLanguage,
      word,
    })),
    skipDuplicates: true,
  });

  const rows = await prisma.word.findMany({
    where: { organizationId, targetLanguage, word: { in: texts } },
  });

  await Promise.all(
    rows.flatMap((row) => {
      const romanization = romanizations.get(row.word);

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

  return new Map(rows.map((row) => [row.word, row.id]));
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
