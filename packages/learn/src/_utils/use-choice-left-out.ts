"use client";

import { useExtracted } from "next-intl";

export function useChoiceLeftOutLine(): string {
  const t = useExtracted();

  return t({
    description:
      "Under a question asking which option of an exam the learner will take, such as its foreign language. Until they pick, their plan has none of the options.",
    message: "Pick one so your plan includes it.",
  });
}
