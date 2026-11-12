"use client";

import {
  type RegionChoice,
  getVarietyName,
  getVarietyNameInSentence,
} from "@zoonk/utils/language-regions";
import { useExtracted } from "next-intl";
import { useAppLocale } from "../_utils/locale";

export function findTaughtRegion(choices: readonly RegionChoice[]): string | null {
  return choices.find((choice) => choice.taught)?.code ?? null;
}

/** "Spanish (Argentina)" with a country, "Spanish" without. */
export function useVarietyName() {
  const locale = useAppLocale();

  return ({ language, region }: { language: string; region: string | null }): string =>
    getVarietyName({ language, region, userLanguage: locale });
}

type VarietyNote = { language: string; region: string | null; taughtRegion: string | null };

/**
 * Where a learner's country differs from the lessons'. Null without a country, or with the one
 * lessons teach: there's no difference to tell.
 */
export function useVarietyNote() {
  const t = useExtracted();
  const locale = useAppLocale();

  return function varietyNote({ language, region, taughtRegion }: VarietyNote): string | null {
    if (!region || !taughtRegion || region === taughtRegion) {
      return null;
    }

    return t({
      description:
        "{taughtVariety} is a language with a country, written as it reads inside a sentence, such as “Spanish (Mexico)”.",
      message: "Lessons and their audio use {taughtVariety}.",
      values: {
        taughtVariety: getVarietyNameInSentence({
          language,
          region: taughtRegion,
          userLanguage: locale,
        }),
      },
    });
  };
}
