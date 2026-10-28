import "server-only";
import { prisma } from "@zoonk/db";
import { sentenceKey } from "../../activities/templates/_utils/language";
import { type SpokenWordResult } from "../spoken-answer-match";

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
