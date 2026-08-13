import { emptyToNull } from "@zoonk/utils/string";
import { type WordMetadataEntry } from "../generate-sentence-word-metadata-step";
import { collectTranslatedReadingWords } from "./collect-reading-target-words";
import { collectTargetWords } from "./collect-target-words";
import { type ReadingLessonContent } from "./generated-lesson-content";
import {
  type GeneratedWordMetadata,
  saveGeneratedWordMetadata,
} from "./save-generated-word-metadata";

type ReadingSentence = ReadingLessonContent["sentences"][number];

type ReadingWordMetadataInput = {
  distractors: Record<string, string[]>;
  organizationId: string;
  pronunciations: Record<string, string>;
  sentences: ReadingSentence[];
  targetLanguage: string;
  userLanguage: string;
  wordAudioUrls: Record<string, string>;
  wordMetadata: Record<string, WordMetadataEntry>;
};

/** Extracts unique distractor words from each generated sentence. */
function getReadingDistractorWords({
  distractors,
  sentences,
}: Pick<ReadingWordMetadataInput, "distractors" | "sentences">): string[] {
  return sentences.flatMap((sentence) => distractors[sentence.sentence] ?? []);
}

/**
 * A missing metadata entry preserves an existing romanization, while an
 * explicit null or empty result clears stale reusable metadata.
 */
function getRomanizationUpdate(metadata?: WordMetadataEntry): { romanization?: string | null } {
  if (metadata === undefined) {
    return {};
  }

  return { romanization: emptyToNull(metadata.romanization ?? null) };
}

/** Converts one reading target word into its reusable persistence shape. */
function getReadingWordMetadata({
  isCanonical,
  params,
  word,
}: {
  isCanonical: boolean;
  params: ReadingWordMetadataInput;
  word: string;
}): GeneratedWordMetadata {
  const metadata = params.wordMetadata[word];
  const romanization = emptyToNull(metadata?.romanization ?? null);

  return {
    audioUrl: params.wordAudioUrls[word] ?? null,
    pronunciation: params.pronunciations[word] ?? null,
    romanization,
    romanizationUpdate: isCanonical ? { romanization } : getRomanizationUpdate(metadata),
    word,
  };
}

/**
 * Persists reusable word/audio/pronunciation metadata outside the structural
 * lesson transaction so its duration does not grow with sentence word count.
 */
export async function saveReadingWordMetadata(
  params: ReadingWordMetadataInput,
): Promise<Record<string, string>> {
  const translatedWords = collectTranslatedReadingWords({
    sentences: params.sentences,
    wordMetadata: params.wordMetadata,
  });

  const allTargetWords = collectTargetWords({
    canonicalWords: translatedWords,
    generatedWords: getReadingDistractorWords(params),
  });

  const canonicalWords = new Set(translatedWords);

  return saveGeneratedWordMetadata({
    organizationId: params.organizationId,
    targetLanguage: params.targetLanguage,
    userLanguage: params.userLanguage,
    words: allTargetWords.map((word) =>
      getReadingWordMetadata({ isCanonical: canonicalWords.has(word), params, word }),
    ),
  });
}
