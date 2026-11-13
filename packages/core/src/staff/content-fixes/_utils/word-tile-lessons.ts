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

function readingStepsThatMayShow(word: TileWord) {
  return {
    kind: "reading" as const,
    sentence: {
      OR: [
        { sentence: { contains: word.word, mode: "insensitive" as const } },
        { lessonSentences: { some: { distractors: { has: word.word } } } },
      ],
    },
  };
}

/**
 * The lessons whose reading and fill-in-the-blank tiles borrow the word's romanization and clip,
 * matched by text as the player matches them.
 */
export async function findLessonsWithWordTiles(
  db: TransactionClient,
  word: TileWord,
): Promise<{ lessonId: string }[]> {
  const steps = await db.step.findMany({
    select: { content: true, kind: true, lessonId: true, sentenceId: true },
    where: {
      ...CURRENT_STEPS,
      OR: [{ kind: "fillBlank" }, readingStepsThatMayShow(word)],
      lesson: { targetLanguage: word.targetLanguage },
    },
  });

  const reading = steps.flatMap((step) =>
    step.kind === "reading" && step.sentenceId
      ? [{ lessonId: step.lessonId, sentenceId: step.sentenceId }]
      : [],
  );

  const links =
    reading.length === 0
      ? []
      : await db.lessonSentence.findMany({
          select: {
            distractors: true,
            lessonId: true,
            sentence: { select: { sentence: true } },
            sentenceId: true,
          },
          where: { OR: reading },
        });

  const sentences = new Map(
    links.map((link) => [
      linkKey(link),
      { distractors: link.distractors, sentence: link.sentence.sentence },
    ]),
  );

  const key = normalizeWordKey({ language: word.targetLanguage, word: word.word });

  return steps.filter((step) =>
    listStepTiles({ sentences, step }).some(
      (text) => normalizeWordKey({ language: word.targetLanguage, word: text }) === key,
    ),
  );
}
