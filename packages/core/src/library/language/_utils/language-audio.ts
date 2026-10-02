import "server-only";
import { type SpeechProvenance } from "@zoonk/ai/tasks/audio";
import { prisma } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { generateLanguageAudio } from "../../../audio/generate-language-audio";

type AudioTarget = { id: string; text: string };

type VoicedClip = { provenance: SpeechProvenance; url: string };

async function generateAudio({
  orgSlug,
  targetLanguage,
  text,
  textType,
}: {
  orgSlug: string;
  targetLanguage: string;
  text: string;
  textType: "sentence" | "word";
}): Promise<VoicedClip | null> {
  const { data, error } = await generateLanguageAudio({
    language: targetLanguage,
    orgSlug,
    text,
    textType,
  });

  if (error) {
    logError(`Error generating audio for "${text}":`, error);
    return null;
  }

  return data;
}

/** The clip's URL with the text-to-speech run that voiced it. */
function toAudioData({ provenance, url }: VoicedClip) {
  return {
    audioGeneratedAt: new Date(provenance.generatedAt),
    audioModel: provenance.model,
    audioPromptVersion: provenance.promptVersion,
    audioRunId: provenance.runId,
    audioUrl: url,
  };
}

async function fillWordAudio({
  orgSlug,
  targetLanguage,
  word,
}: {
  orgSlug: string;
  targetLanguage: string;
  word: AudioTarget;
}) {
  const clip = await generateAudio({ orgSlug, targetLanguage, text: word.text, textType: "word" });

  if (clip) {
    await prisma.word.updateMany({
      data: toAudioData(clip),
      where: { audioUrl: null, id: word.id },
    });
  }
}

async function fillSentenceAudio({
  orgSlug,
  sentence,
  targetLanguage,
}: {
  orgSlug: string;
  sentence: AudioTarget;
  targetLanguage: string;
}) {
  const clip = await generateAudio({
    orgSlug,
    targetLanguage,
    text: sentence.text,
    textType: "sentence",
  });

  if (clip) {
    await prisma.sentence.updateMany({
      data: toAudioData(clip),
      where: { audioUrl: null, id: sentence.id },
    });
  }
}

/**
 * Audio belongs to the target language, not the pair, so a word or sentence
 * that any lesson already voiced is reused and only the silent ones are sent
 * to text-to-speech. A clip that fails stays missing: the screen still works
 * without it and the next lesson that uses the word tries again.
 */
export async function fillMissingAudio({
  orgSlug,
  sentenceIds,
  targetLanguage,
  wordIds,
}: {
  orgSlug: string;
  sentenceIds: readonly string[];
  targetLanguage: string;
  wordIds: readonly string[];
}): Promise<void> {
  if (!isTTSSupportedLanguage(targetLanguage)) {
    return;
  }

  const [words, sentences] = await Promise.all([
    prisma.word.findMany({ where: { audioUrl: null, id: { in: [...wordIds] } } }),
    prisma.sentence.findMany({ where: { audioUrl: null, id: { in: [...sentenceIds] } } }),
  ]);

  await Promise.all([
    ...words.map((word) =>
      fillWordAudio({ orgSlug, targetLanguage, word: { id: word.id, text: word.word } }),
    ),
    ...sentences.map((sentence) =>
      fillSentenceAudio({
        orgSlug,
        sentence: { id: sentence.id, text: sentence.sentence },
        targetLanguage,
      }),
    ),
  ]);
}
