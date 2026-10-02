"use client";

import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../../_components/section-label";
import { LearnLink } from "../../learn-link";
import { LANGUAGE_ROW_LINK_CLASS } from "../current-unit";
import { UnitBadge } from "../unit-parts";
import { type AlphabetLink, AlphabetRow } from "./alphabet-row";

/** A unit as Content lists it: its title and where its page is. */
type LanguageUnitLink = { href: string; id: string; title: string };

/**
 * The course's units on Content, each one real situation with its own page (grammar tips, words,
 * mistakes and a conversation to practice), in the order they're taught. A script that isn't
 * Latin lists its alphabet lesson first.
 */
export function LanguageUnitsList({
  alphabet,
  onSkipAlphabet,
  units,
}: {
  alphabet: AlphabetLink | null;
  onSkipAlphabet: () => Promise<boolean>;
  units: LanguageUnitLink[];
}) {
  const t = useExtracted();

  if (units.length === 0 && !alphabet) {
    return null;
  }

  return (
    <nav aria-labelledby="language-units" className="mb-8 flex flex-col gap-3">
      <SectionLabel id="language-units">{t("Units")}</SectionLabel>
      {alphabet && <AlphabetRow alphabet={alphabet} onSkip={onSkipAlphabet} />}
      <ol className="flex flex-col gap-2">
        {units.map((unit, index) => (
          <li key={unit.id}>
            <LearnLink className={LANGUAGE_ROW_LINK_CLASS} href={unit.href}>
              <UnitBadge position={index + 1} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-muted-foreground text-xs">
                  {t("Unit {position, number}", { position: index + 1 })}
                </span>
                <span className="font-medium">{unit.title}</span>
              </span>
              <ChevronRightIcon
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
              />
            </LearnLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}
