"use client";

import { type TutorToolOffer } from "@zoonk/core/lesson-questions/tool-offer-contract";
import { Flag, isFlagCode } from "@zoonk/ui/components/language-flag";
import { safeAsync } from "@zoonk/utils/error";
import { getVarietyFlagCode, getVarietyNameInSentence } from "@zoonk/utils/language-regions";
import { LanguagesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { useAppLocale } from "../_utils/locale";
import { useVarietyName, useVarietyNote } from "../language-variety/use-variety-words";
import { OfferButton, OfferCard, OfferTile } from "./tutor-offer-card";

type VarietyOfferView = Extract<TutorToolOffer, { kind: "variety" }>;

function VarietyTile({ offer }: { offer: VarietyOfferView }) {
  const flag = getVarietyFlagCode({ language: offer.targetLanguage, region: offer.targetRegion });

  return isFlagCode(flag) ? (
    <Flag className="w-4.5" code={flag} />
  ) : (
    <OfferTile>
      <LanguagesIcon />
    </OfferTile>
  );
}

/**
 * Nothing is saved before the tap. `saved` is the goal already having this country. Apply is a
 * form, so React sends a tap made before the page hydrates once it does.
 */
export function VarietyOffer({
  offer,
  onApply,
  saved,
}: {
  offer: VarietyOfferView;
  onApply: () => Promise<boolean>;
  saved: boolean;
}) {
  const t = useExtracted();
  const locale = useAppLocale();
  const cardRef = useRef<HTMLElement>(null);
  const varietyName = useVarietyName();
  const varietyNote = useVarietyNote();
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<"failed" | "saved" | null>(null);
  const { targetLanguage: language, targetRegion: region, taughtRegion } = offer;

  const apply = () => {
    setOutcome(null);

    startTransition(async () => {
      const { data: applied } = await safeAsync(onApply);
      setOutcome(applied ? "saved" : "failed");

      if (applied) {
        // The button leaves with the save, so focus stays on the card that says how it went.
        cardRef.current?.focus();
      }
    });
  };

  return (
    <OfferCard
      description={
        varietyNote({ language, region, taughtRegion }) ??
        t({
          description:
            "{variety} is a language with a country, written as it reads inside a sentence, such as “Spanish (Mexico)”.",
          message: "Your buddy and practice calls use {variety}.",
          values: { variety: getVarietyNameInSentence({ language, region, userLanguage: locale }) },
        })
      }
      ref={cardRef}
      tile={<VarietyTile offer={offer} />}
      title={varietyName({ language, region })}
    >
      {saved || outcome === "saved" ? (
        <p className="text-muted-foreground text-sm" role="status">
          {t("Saved. You can change it in your plan.")}
        </p>
      ) : (
        <form action={apply}>
          <OfferButton busy={isPending} type="submit">
            {t("Apply")}
          </OfferButton>
        </form>
      )}

      {outcome === "failed" && <ChangeSaveError />}
    </OfferCard>
  );
}
