"use client";

import { type TutorToolOffer } from "@zoonk/core/lesson-questions/tool-offer-contract";
import { getVarietyNameInSentence } from "@zoonk/utils/language-regions";
import { LanguagesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useAppLocale } from "../_utils/locale";
import { useVarietyName, useVarietyNote } from "../language-variety/use-variety-words";
import { ApplyOfferCard, FlagTile } from "./tutor-apply-offer";

export function VarietyOffer({
  offer,
  onApply,
  saved,
}: {
  offer: Extract<TutorToolOffer, { kind: "variety" }>;
  onApply: () => Promise<boolean>;
  saved: boolean;
}) {
  const t = useExtracted();
  const locale = useAppLocale();
  const varietyName = useVarietyName();
  const varietyNote = useVarietyNote();
  const { targetLanguage: language, targetRegion: region, taughtRegion } = offer;

  return (
    <ApplyOfferCard
      applyLabel={t("Apply")}
      description={
        varietyNote({ language, region, taughtRegion }) ??
        t({
          description:
            "{variety} is a language with a country, written as it reads inside a sentence, such as “Spanish (Mexico)”.",
          message: "Your buddy and practice calls use {variety}.",
          values: { variety: getVarietyNameInSentence({ language, region, userLanguage: locale }) },
        })
      }
      onApply={onApply}
      saved={saved}
      savedText={t("Saved. You can change it in your plan.")}
      tile={<FlagTile fallback={<LanguagesIcon />} flag={offer.languageFlag} />}
      title={varietyName({ language, region })}
    />
  );
}
