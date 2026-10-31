"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { useFormatter } from "next-intl";

export function usePickedNames(choice: ExamChoiceView): string | null {
  const format = useFormatter();

  const names = choice.options.flatMap((option) =>
    choice.subjects.includes(option.name) ? [option.shortName ?? option.name] : [],
  );

  return names.length > 0 ? format.list(names, { type: "conjunction" }) : null;
}
