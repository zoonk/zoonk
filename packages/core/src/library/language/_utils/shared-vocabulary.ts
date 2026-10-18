import "server-only";
import { type LanguageLessonContent } from "@zoonk/ai/tasks/v2/language/language-lesson";
import { prisma } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";

type SharedVocabularyInput = {
  content: LanguageLessonContent;
  learnerLanguage: string;
  organizationId: string;
  /** The lesson run that wrote the words, romanizations, respellings and tips. */
  provenance: LibraryProvenance;
  targetLanguage: string;
};

export type SharedVocabulary = {
  /** Every `Word` row the lesson can show, by text: its words and their wrong options. */
  wordIdsByText: Map<string, string>;
  sentenceIdsByText: Map<string, string>;
};

/**
 * Words and sentences are shared by every language pair learning the target
 * language, so they are created once (concurrent lessons may add the same
 * word at the same moment) and a romanization is only added where none exists.
 * The run that wrote a row, or filled its romanization, is its provenance.
 */
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

/**
 * Respellings and tips depend on the learner's language, not the lesson, so
 * each word keeps one per language. An existing respelling stays; a missing
 * tip (rows written before tips existed) is filled.
 */
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

/**
 * Stores the target-language side of a lesson where every language pair can
 * reuse it: its words and their wrong options, its sentences, and the
 * respellings and tips for speakers of the lesson's language.
 */
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
