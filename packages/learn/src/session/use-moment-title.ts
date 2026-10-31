"use client";

import { useExtracted } from "next-intl";
import { type StudyBlock } from "./session-types";

export type MomentKind = StudyBlock["kind"];

export function useMomentTitle({ kind, testedOut }: { kind: MomentKind; testedOut: boolean }) {
  const t = useExtracted();

  if (kind === "learn") {
    return testedOut ? t("You already knew this") : t("Lesson complete");
  }

  if (kind === "review") {
    return t("Review done");
  }

  return t("Practice done");
}
