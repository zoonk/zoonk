import { prisma } from "@zoonk/db";
import {
  deduplicateNormalizedTexts,
  emptyToNull,
  extractUniqueSentenceWords,
} from "@zoonk/utils/string";
import { type WordMetadataEntry } from "../generate-sentence-word-metadata-step";
import { fetchExistingWordCasing } from "./fetch-existing-word-casing";
import { type ReadingLessonContent } from "./generated-lesson-content";
import { upsertWordWithPronunciation } from "./upsert-word-with-pronunciation";

type ReadingSentence = ReadingLessonContent["sentences"][number];

export async function saveReadingTargetWords(params: {
  distractors: Record<string, string[]>;
  lessonId: string;
  organizationId: string;
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
    distractorOnlyWords.map((word) => {
      const metadata = params.wordMetadata[word];
      const romanization = emptyToNull(metadata?.romanization ?? null);

      return upsertWordWithPronunciation({
        audioUrl: params.wordAudioUrls[word] ?? null,
        organizationId: params.organizationId,
        pronunciation: params.pronunciations[word] ?? null,
        romanization,
        romanizationUpdate: getRomanizationUpdate(metadata),
        targetLanguage: params.targetLanguage,
        userLanguage: params.userLanguage,
        word: existingCasing[word.toLowerCase()] ?? word,
      });
    }),
  );
}

function extractCanonicalWords(
  sentences: ReadingSentence[],
  wordMetadata: Record<string, WordMetadataEntry>,
): string[] {
  return extractUniqueSentenceWords(sentences.map((entry) => entry.sentence)).filter(
    (word) => wordMetadata[word]?.translation,
  );
}

function extractDistractorWords(
  sentences: ReadingSentence[],
  distractors: Record<string, string[]>,
): string[] {
  return deduplicateNormalizedTexts(
    sentences.flatMap((sentence) => distractors[sentence.sentence] ?? []),
  );
}

function removeCanonicalWords(canonicalWords: string[], distractorWords: string[]): string[] {
  const canonicalWordKeys = new Set(canonicalWords.map((word) => word.toLowerCase()));
  return distractorWords.filter((word) => !canonicalWordKeys.has(word.toLowerCase()));
}

function getRomanizationUpdate(metadata?: WordMetadataEntry): {
  romanization?: string | null;
} {
  if (metadata === undefined) {
    return {};
  }

  return { romanization: emptyToNull(metadata.romanization ?? null) };
}

async function saveCanonicalSentenceWord(params: {
  existingCasing: Record<string, string>;
  lessonId: string;
  organizationId: string;
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
  const wordId = await upsertWordWithPronunciation({
    audioUrl: params.wordAudioUrls[params.word] ?? null,
    organizationId: params.organizationId,
    pronunciation: params.pronunciations[params.word] ?? null,
    romanization,
    romanizationUpdate: { romanization },
    targetLanguage: params.targetLanguage,
    userLanguage: params.userLanguage,
    word: dbWord,
  });

  await prisma.lessonWord.upsert({
    create: {
      distractors: [],
      lessonId: params.lessonId,
      translation,
      userLanguage: params.userLanguage,
      wordId,
    },
    update: { translation },
    where: {
      lessonWord: {
        lessonId: params.lessonId,
        wordId,
      },
    },
  });
}
