"use client";

import { useExtracted } from "next-intl";

export function useChoiceLeftOutLine(take: number): string {
  const t = useExtracted();

  if (take > 1) {
    return t({
      description:
        "Under a question asking which options of an exam the learner will take, such as two of its subject modules. Until they pick, their plan has none of the options. {take} is how many they can pick, always 2 or more.",
      message: "Pick up to {take, number} so your plan includes them.",
      values: { take },
    });
  }

  return t({
    description:
      "Under a question asking which option of an exam the learner will take, such as its foreign language. Until they pick, their plan has none of the options.",
    message: "Pick one so your plan includes it.",
  });
}
