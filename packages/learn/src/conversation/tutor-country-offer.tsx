"use client";

import { type TutorToolOffer } from "@zoonk/core/lesson-questions/tool-offer-contract";
import { MapPinIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLessonLanguageLine } from "../country/use-country-lines";
import { ApplyOfferCard, FlagTile } from "./tutor-apply-offer";

type CountryOfferView = Extract<TutorToolOffer, { kind: "contentCountry" | "homeCountry" }>;

type CountryOfferProps = {
  offer: CountryOfferView;
  onApply: () => Promise<boolean>;
  saved: boolean;
};

export function ContentCountryOffer({ offer, onApply, saved }: CountryOfferProps) {
  const t = useExtracted();
  const lessonLanguage = useLessonLanguageLine()(offer.lessonVariety);

  return (
    <ApplyOfferCard
      applyLabel={t("Apply")}
      description={
        <>
          {t(
            "Applying it rebuilds your plan for this country. The lessons you've finished stay done.",
          )}
          {lessonLanguage && (
            <>
              <br />
              {lessonLanguage}
            </>
          )}
        </>
      }
      onApply={onApply}
      saved={saved}
      savedText={t("Saved. Your new plan is being prepared, and you can keep studying meanwhile.")}
      tile={<FlagTile fallback={<MapPinIcon />} flag={offer.languageFlag} />}
      title={t({
        description:
          "{country} is a country's name. It always follows the colon, so it never needs an article or a case.",
        message: "Content country: {country}",
        values: { country: offer.countryName },
      })}
    />
  );
}

export function HomeCountryOffer({ offer, onApply, saved }: CountryOfferProps) {
  const t = useExtracted();

  return (
    <ApplyOfferCard
      applyLabel={t("Save")}
      description={t(
        "For new goals and your examples. It doesn't change the plans you already have.",
      )}
      onApply={onApply}
      saved={saved}
      savedText={t("Saved. You can change it in Preferences.")}
      tile={<FlagTile fallback={<MapPinIcon />} flag={offer.languageFlag} />}
      title={t({
        description:
          "{country} is a country's name. It always follows the colon, so it never needs an article or a case.",
        message: "Where you live: {country}",
        values: { country: offer.countryName },
      })}
    />
  );
}
