import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import {
  type TextLayout,
  findPlaceholderText,
  findUnrenderedMarkdown,
} from "@zoonk/utils/text-flaws";
import {
  findAnswerKeyProblems,
  findEquivalentOptions,
  findOptionDataProblems,
} from "../../_utils/option-checks";

type ScreenFlaw = {
  code: "answerKey" | "duplicateOptions" | "markdown" | "optionData" | "placeholder";
  problem: string;
};

/**
 * Options a learner can't tell apart, options the screen's data disagrees with (sensors A to E
 * against options A to D) and a typed answer's sample that gives none of the answers code accepts.
 */
export function findAnswerFlaws({
  language,
  screen,
}: {
  language: string;
  screen: WrittenScreen;
}): ScreenFlaw[] {
  if (screen.kind === "typedAnswer") {
    return findAnswerKeyProblems(screen).map((problem) => ({ code: "answerKey", problem }));
  }

  if (screen.kind !== "check" && screen.kind !== "hookGuess") {
    return [];
  }

  const options = screen.options.map((option) => option.text);
  const data = screen.kind === "check" ? [screen.context, screen.question] : [screen.question];

  return [
    ...findEquivalentOptions({ language, texts: options }).map((problem) => ({
      code: "duplicateOptions" as const,
      problem,
    })),
    ...findOptionDataProblems({ data, options }).map((problem) => ({
      code: "optionData" as const,
      problem,
    })),
  ];
}

/**
 * Markdown the player would show as marks, and text a writer left unfinished. A formula (`layout`
 * null) is LaTeX, never Markdown.
 */
export function findTextFlaws({
  layout,
  text,
}: {
  layout: TextLayout | null;
  text: string;
}): ScreenFlaw[] {
  return [
    ...(layout ? findUnrenderedMarkdown({ layout, text }) : []).map((problem) => ({
      code: "markdown" as const,
      problem,
    })),
    ...findPlaceholderText(text).map((problem) => ({ code: "placeholder" as const, problem })),
  ];
}
