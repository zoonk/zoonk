import "server-only";
import { prisma } from "@zoonk/db";
import { sentenceKey } from "../../activities/templates/_utils/language";
import { type SpokenWordResult } from "../spoken-answer-match";

/**
 * A word worth practicing after a spoken answer, with what the player needs to help: the native
 * audio, the respelling for speakers of the learner's language and its one sound tip. Words the
 * lessons never taught have none of them, and the player reads them with the device's voice.
 */
export type SpokenPracticeWord = SpokenWordResult & {
  audioUrl: string | null;
  respelling: string | null;
  tip: string | null;
};

type WordDetails = Pick<SpokenPracticeWord, "audioUrl" | "respelling" | "tip">;

const NO_DETAILS: WordDetails = { audioUrl: null, respelling: null, tip: null };

async function findWordDetails({
  learnerLanguage,
  surfaces,
  targetLanguage,
}: {
  learnerLanguage: string;
  /** Lowercase and without the sentence's punctuation: "Rent?" is the word "rent". */
  surfaces: string[];
  targetLanguage: string;
}): Promise<Map<string, WordDetails>> {
  if (surfaces.length === 0) {
    return new Map();
  }

  const candidates = [
    ...new Set(
      surfaces.flatMap((surface) => [surface, surface.charAt(0).toUpperCase() + surface.slice(1)]),
    ),
  ];

  const words = await prisma.word.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      audioUrl: true,
      pronunciations: {
        select: { pronunciation: true, tip: true },
        where: { userLanguage: learnerLanguage },
      },
      word: true,
    },
    where: { targetLanguage, word: { in: candidates } },
  });

  return words.reduce((details, row) => {
    const surface = row.word.toLowerCase();
    const current = details.get(surface) ?? NO_DETAILS;
    const [pronunciation] = row.pronunciations;

    return details.set(surface, {
      audioUrl: current.audioUrl ?? row.audioUrl,
      respelling: current.respelling ?? pronunciation?.pronunciation ?? null,
      tip: current.tip ?? pronunciation?.tip ?? null,
    });
  }, new Map<string, WordDetails>());
}

/**
 * The words to practice after a spoken answer (at most two, picked by the grader), each with its
 * native audio, respelling and sound tip from the shared vocabulary when the word has them. Every
 * organization's copy of a word counts, since a word sounds the same whoever taught it.
 */
export async function loadPracticeWords({
  learnerLanguage,
  targetLanguage,
  words,
}: {
  learnerLanguage: string;
  targetLanguage: string;
  words: readonly SpokenWordResult[];
}): Promise<SpokenPracticeWord[]> {
  const details = await findWordDetails({
    learnerLanguage,
    surfaces: words.map((word) => sentenceKey(word.text)),
    targetLanguage,
  });

  return words.map((word) => ({ ...word, ...(details.get(sentenceKey(word.text)) ?? NO_DETAILS) }));
}
