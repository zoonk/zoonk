"use client";

import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import { useExtracted } from "next-intl";

type Skill = LanguageProgressView["levels"][number]["skill"];

export function useSkillName() {
  const t = useExtracted();

  return (skill: Skill): string => {
    switch (skill) {
      case "listening":
        return t("Listening");
      case "reading":
        return t("Reading");
      case "speaking":
        return t("Speaking");
      case "writing":
        return t("Writing");
      default:
        return skill satisfies never;
    }
  };
}
