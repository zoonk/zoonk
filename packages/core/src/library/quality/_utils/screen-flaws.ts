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
