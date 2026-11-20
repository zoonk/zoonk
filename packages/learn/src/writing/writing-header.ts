"use client";

import { type WritingPrompt } from "@zoonk/core/exams/essays/writing-contract";
import { useExtracted } from "next-intl";

export function useHeaderLabel(writing: WritingPrompt): string {
  const t = useExtracted();
  return writing.unit === "drill" ? t("Writing drill") : t("Written answer");
}
