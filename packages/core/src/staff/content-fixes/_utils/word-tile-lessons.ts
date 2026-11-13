import { type TransactionClient } from "@zoonk/db";
import { CURRENT_STEPS } from "../../../library/lessons/lesson-versions";
import {
  listTargetBankWords,
  normalizeWordKey,
} from "../../../player/contracts/build-word-bank-options";

type TileWord = { targetLanguage: string; word: string };

type TileStep = { content: unknown; kind: string; lessonId: string; sentenceId: string | null };

type TileSentence = { distractors: string[]; sentence: string };

function linkKey({ lessonId, sentenceId }: { lessonId: string; sentenceId: string | null }) {
  return `${lessonId}:${sentenceId}`;
}

/** A reading screen's tiles come from its own lesson's link to the sentence. */
function listStepTiles({
  sentences,
  step,
}: {
  sentences: ReadonlyMap<string, TileSentence>;
  step: TileStep;
}): string[] {
  const sentence = sentences.get(linkKey(step));

  return listTargetBankWords({
    sentences: new Map(sentence && step.sentenceId ? [[step.sentenceId, sentence]] : []),
    steps: [step],
  });
}

/**
 * The lessons whose word distractors and reading and fill-in-the-blank tiles borrow the word's
 * romanization and clip, matched by text as the player matches them.
 */
export async function findLessonsWithWordTiles(
  db: TransactionClient,
  word: TileWord,
): Promise<{ lessonId: string }[]> {
  const lesson = { targetLanguage: word.targetLanguage };

  const [steps, sentenceLinks, wordLinks] = await Promise.all([
    db.step.findMany({
      select: { content: true, kind: true, lessonId: true, sentenceId: true },
      where: { ...CURRENT_STEPS, kind: { in: ["fillBlank", "reading"] }, lesson },
    }),
    db.lessonSentence.findMany({
      select: {
        distractors: true,
        lessonId: true,
        sentence: { select: { sentence: true } },
        sentenceId: true,
      },
      where: { lesson },
    }),
    db.lessonWord.findMany({
      select: { distractors: true, lessonId: true },
      where: { distractors: { isEmpty: false }, lesson },
    }),
  ]);

  const sentences = new Map(
    sentenceLinks.map((link) => [
      linkKey(link),
      { distractors: link.distractors, sentence: link.sentence.sentence },
    ]),
  );

  const key = normalizeWordKey({ language: word.targetLanguage, word: word.word });

  const isWord = (text: string) =>
    normalizeWordKey({ language: word.targetLanguage, word: text }) === key;

  return [
    ...steps.filter((step) => listStepTiles({ sentences, step }).some((text) => isWord(text))),
    ...wordLinks.filter((link) => link.distractors.some((text) => isWord(text))),
  ];
}
