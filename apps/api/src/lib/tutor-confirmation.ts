import { type TutorToolOffer } from "@zoonk/core/lesson-questions/contract";
import { getExtracted } from "next-intl/server";
import { type AnswerRun } from "./tutor-answers";

/** The words of one line after another's: a paragraph break, as the saved answer joins steps. */
const LINE_BREAK = "\n\n";

/**
 * The words a buddy answer says when the model only acted, read in the conversation's language
 * while the request starts, before its stream.
 */
export async function loadConfirmationWords(language: string) {
  const t = await getExtracted({ locale: language });

  return {
    chapterTest: (chapter: string) =>
      t("Below is a short test on {chapter}: passing it skips the lessons you already know.", {
        chapter,
      }),
    chooseFocus: t(
      "Below you can choose where to focus, or take a short test that chooses for you.",
    ),
    conversationCall: t("Below you can start a short practice call whenever you're ready."),
    essay: (subject: string) =>
      t("Below you can see when your plan practices {subject}.", { subject }),
    logbook: t("Below is your week in review."),
    memory: t("Below you can see and change what I remember about you."),
    mistakes: t("Below is your mistakes notebook, with practice for each one."),
    mockExam: t("Below you can choose a mock exam to take now."),
    plus: t("Below is the Plus page."),
    pronunciation: t("Below you can say again the words that were hard to pronounce."),
    proposal: t("I've put the change to your plan below. Nothing changes until you apply it."),
    startGoal: t("Below you can start it as a new goal."),
    stats: t("Below are your statistics."),
  };
}

type ConfirmationWords = Awaited<ReturnType<typeof loadConfirmationWords>>;

function describeOffer({ offer, words }: { offer: TutorToolOffer; words: ConfirmationWords }) {
  switch (offer.kind) {
    case "chapterTest":
      return words.chapterTest(offer.chapterTitle);
    case "essay":
      return words.essay(offer.subject);
    case "chooseFocus":
    case "conversationCall":
    case "logbook":
    case "memory":
    case "mistakes":
    case "mockExam":
    case "plus":
    case "pronunciation":
    case "startGoal":
    case "stats":
      return words[offer.kind];
    default:
      return offer satisfies never;
  }
}

/**
 * What the answer says when the buddy only acted, a card or a button under its answer, and wrote
 * nothing (the model can end on its tools without words): the answer is done and saved, never an
 * error. Null when it did nothing either.
 */
export function confirmToolsOnly({
  run,
  words,
}: {
  run: AnswerRun;
  words: ConfirmationWords;
}): string | null {
  const lines = [
    ...(run.proposals.length > 0 ? [words.proposal] : []),
    ...run.offers.map((offer) => describeOffer({ offer, words })),
  ];

  return lines.length > 0 ? lines.join(LINE_BREAK) : null;
}
