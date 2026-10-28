import { type AlphabetLessonContent } from "@zoonk/ai/tasks/v2/language/alphabet-lesson";
import { type StepKind } from "@zoonk/db";
import { safeParseStepContent } from "../../steps/contract/step-contract";

export type AlphabetStepToSave = { content: object; kind: StepKind };

type Letter = AlphabetLessonContent["letters"][number];

const MAX_GROUP_SIZE = 5;

const MIN_MATCH_PAIRS = 2;

function toCard({
  audioUrls,
  letter,
}: {
  audioUrls: ReadonlyMap<string, string>;
  letter: Letter;
}): AlphabetStepToSave {
  return {
    content: {
      audioText: letter.audioText,
      audioUrl: audioUrls.get(letter.audioText) ?? null,
      forms: letter.forms,
      pronunciation: letter.pronunciation,
      readingAid: letter.readingAid,
      symbol: letter.symbol,
    },
    kind: "alphabet",
  };
}

function toMatch(letters: readonly Letter[]): AlphabetStepToSave[] {
  const pairs = letters
    .filter(
      (letter, index) =>
        letters.findIndex(
          (other) => other.symbol === letter.symbol || other.readingAid === letter.readingAid,
        ) === index,
    )
    .map((letter) => ({ left: letter.symbol, right: letter.readingAid }));

  return pairs.length >= MIN_MATCH_PAIRS ? [{ content: { pairs }, kind: "matchColumns" }] : [];
}

function toGroups(letters: readonly Letter[]): Letter[][] {
  if (letters.length === 0) {
    return [];
  }

  const size = Math.ceil(letters.length / Math.ceil(letters.length / MAX_GROUP_SIZE));

  return Array.from({ length: Math.ceil(letters.length / size) }, (_, index) =>
    letters.slice(index * size, (index + 1) * size),
  );
}

export function buildAlphabetLessonSteps({
  audioUrls,
  content,
}: {
  audioUrls: ReadonlyMap<string, string>;
  content: AlphabetLessonContent;
}): AlphabetStepToSave[] {
  const letters = content.letters
    .map((letter) => ({
      ...letter,
      audioText: letter.audioText.trim(),
      readingAid: letter.readingAid.trim(),
      symbol: letter.symbol.trim(),
    }))
    .filter((letter) => letter.symbol && letter.readingAid);

  const steps: AlphabetStepToSave[] = [
    ...content.intro.map((screen) => ({
      content: { text: screen.text, title: screen.title },
      kind: "explanation" as const,
    })),
    ...toGroups(letters).flatMap((group) => [
      ...group.map((letter) => toCard({ audioUrls, letter })),
      ...toMatch(group),
    ]),
    { content: { ideas: content.summary.map((text) => ({ text })) }, kind: "summary" },
  ];

  return steps.flatMap((step) => {
    const parsed = safeParseStepContent(step.kind, step.content);
    return parsed.success ? [{ ...step, content: parsed.data }] : [];
  });
}
