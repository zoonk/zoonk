import { prisma } from "@zoonk/db";
import {
  deduplicateNormalizedTexts,
  emptyToNull,
  extractUniqueSentenceWords,
} from "@zoonk/utils/string";
import { type ReadingSentence } from "../generate-reading-content-step";
import { fetchExistingWordCasing } from "./fetch-existing-word-casing";

export type WordMetadataEntry = {
  romanization: string | null;
  translation: string;
};

/**
 * Reading activities need two kinds of saved target-language words:
 * canonical sentence tokens, which become lesson vocabulary with lesson-scoped
 * translations, and distractor words, which only need reusable render metadata.
 *
 * Keeping both persistence rules here avoids duplicating the casing lookup, word
 * extraction, and pronunciation save logic in the workflow step itself.
 */
export async function saveReadingTargetWords(params: {
  distractors: Record<string, string[]>;
  lessonId: number;
  organizationId: number;
  pronunciations: Record<string, string>;
  sentences: ReadingSentence[];
  targetLanguage: string;
  userLanguage: string;
  wordAudioUrls: Record<string, string>;
  wordMetadata: Record<string, WordMetadataEntry>;
}): Promise<void> {
  const canonicalWords = extractCanonicalWords(params.sentences, params.wordMetadata);
  const distractorWords = extractDistractorWords(params.sentences, params.distractors);
  const allTargetWords = deduplicateNormalizedTexts([...canonicalWords, ...distractorWords]);

  if (allTargetWords.length === 0) {
    return;
  }

  const existingCasing = await fetchExistingWordCasing({
    organizationId: params.organizationId,
    targetLanguage: params.targetLanguage,
    words: allTargetWords,
  });
  const distractorOnlyWords = removeCanonicalWords(canonicalWords, distractorWords);

  await Promise.all(
    canonicalWords.map((word) =>
      saveCanonicalSentenceWord({
        existingCasing,
        lessonId: params.lessonId,
        organizationId: params.organizationId,
        pronunciations: params.pronunciations,
        targetLanguage: params.targetLanguage,
        userLanguage: params.userLanguage,
        word,
        wordAudioUrls: params.wordAudioUrls,
        wordMetadata: params.wordMetadata,
      }),
    ),
  );

  await Promise.all(
    distractorOnlyWords.map((word) =>
      saveDistractorWord({
        existingCasing,
        organizationId: params.organizationId,
        pronunciations: params.pronunciations,
        targetLanguage: params.targetLanguage,
        userLanguage: params.userLanguage,
        word,
        wordAudioUrls: params.wordAudioUrls,
        wordMetadata: params.wordMetadata,
      }),
    ),
  );
}

/**
 * Canonical sentence words are only saved when we have a lesson-scoped translation for
 * them. That keeps filler punctuation or unsupported tokens out of the lesson vocabulary.
 */
function extractCanonicalWords(
  sentences: ReadingSentence[],
  wordMetadata: Record<string, WordMetadataEntry>,
): string[] {
  return extractUniqueSentenceWords(sentences.map((entry) => entry.sentence)).filter(
    (word) => wordMetadata[word]?.translation,
  );
}

/**
 * Reading distractors are stored per sentence, but word metadata is generated once per
 * unique normalized surface form across the whole activity.
 */
function extractDistractorWords(
  sentences: ReadingSentence[],
  distractors: Record<string, string[]>,
): string[] {
  return deduplicateNormalizedTexts(
    sentences.flatMap((sentence) => distractors[sentence.sentence] ?? []),
  );
}

/**
 * Canonical tokens and distractors can overlap after normalization. We skip overlaps here
 * so distractor-only saves do not duplicate a canonical lesson word save.
 */
function removeCanonicalWords(canonicalWords: string[], distractorWords: string[]): string[] {
  const canonicalWordKeys = new Set(canonicalWords.map((word) => word.toLowerCase()));
  return distractorWords.filter((word) => !canonicalWordKeys.has(word.toLowerCase()));
}

/**
 * Reading still needs these `LessonWord` rows for canonical sentence tokens because the
 * same surface word can mean different things in different lessons. We intentionally do
 * not update `LessonWord.distractors` here so vocabulary-owned distractors stay intact.
 */
async function saveCanonicalSentenceWord(params: {
  existingCasing: Record<string, string>;
  lessonId: number;
  organizationId: number;
  pronunciations: Record<string, string>;
  targetLanguage: string;
  userLanguage: string;
  word: string;
  wordAudioUrls: Record<string, string>;
  wordMetadata: Record<string, WordMetadataEntry>;
}): Promise<void> {
  const metadata = params.wordMetadata[params.word];
  const translation = metadata?.translation ?? "";
  const romanization = emptyToNull(metadata?.romanization ?? null);
  const dbWord = params.existingCasing[params.word.toLowerCase()] ?? params.word;
  const audioUrl = params.wordAudioUrls[params.word] ?? null;
  const pronunciation = params.pronunciations[params.word] ?? null;

  const record = await prisma.word.upsert({
    create: {
      audioUrl,
      organizationId: params.organizationId,
      romanization,
      targetLanguage: params.targetLanguage,
      word: dbWord,
    },
    update: {
      ...(audioUrl ? { audioUrl } : {}),
      romanization,
    },
    where: {
      orgWord: {
        organizationId: params.organizationId,
        targetLanguage: params.targetLanguage,
        word: dbWord,
      },
    },
  });

  if (pronunciation) {
    await prisma.wordPronunciation.upsert({
      create: {
        pronunciation,
        userLanguage: params.userLanguage,
        wordId: record.id,
      },
      update: { pronunciation },
      where: {
        wordPronunciation: {
          userLanguage: params.userLanguage,
          wordId: record.id,
        },
      },
    });
  }

  await prisma.lessonWord.upsert({
    create: {
      distractors: [],
      lessonId: params.lessonId,
      translation,
      userLanguage: params.userLanguage,
      wordId: record.id,
    },
    update: {
      translation,
    },
    where: {
      lessonWord: {
        lessonId: params.lessonId,
        wordId: record.id,
      },
    },
  });
}

/**
 * Reading distractors need the same audio and pronunciation experience as canonical
 * words, but they must not become taught lesson vocabulary.
 */
async function saveDistractorWord(params: {
  existingCasing: Record<string, string>;
  organizationId: number;
  pronunciations: Record<string, string>;
  targetLanguage: string;
  userLanguage: string;
  word: string;
  wordAudioUrls: Record<string, string>;
  wordMetadata: Record<string, WordMetadataEntry>;
}): Promise<void> {
  const dbWord = params.existingCasing[params.word.toLowerCase()] ?? params.word;
  const audioUrl = params.wordAudioUrls[params.word] ?? null;
  const pronunciation = params.pronunciations[params.word] ?? null;
  const romanization = emptyToNull(params.wordMetadata[params.word]?.romanization ?? null);

  const record = await prisma.word.upsert({
    create: {
      audioUrl,
      organizationId: params.organizationId,
      romanization,
      targetLanguage: params.targetLanguage,
      word: dbWord,
    },
    update: {
      ...(audioUrl ? { audioUrl } : {}),
      romanization,
    },
    where: {
      orgWord: {
        organizationId: params.organizationId,
        targetLanguage: params.targetLanguage,
        word: dbWord,
      },
    },
  });

  if (pronunciation) {
    await prisma.wordPronunciation.upsert({
      create: {
        pronunciation,
        userLanguage: params.userLanguage,
        wordId: record.id,
      },
      update: { pronunciation },
      where: {
        wordPronunciation: {
          userLanguage: params.userLanguage,
          wordId: record.id,
        },
      },
    });
  }
}
