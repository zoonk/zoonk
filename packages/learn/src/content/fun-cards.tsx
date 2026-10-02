"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { GalleryVerticalEndIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { CardFiltersBar } from "./card-filters-bar";
import { toCardSections } from "./card-sections";
import { type ContentGroup, useContentScreen } from "./content-context";
import { ContentMapEntry } from "./content-map-links";
import { FunCardGroups } from "./fun-card-groups";
import { ReviewsDue } from "./reviews-due";
import { SummaryCards } from "./summary-cards";
import { useCardFilters } from "./use-card-filters";

/** A goal with several courses or exam subjects counts those; otherwise its chapters. */
function countAreas(groups: ContentGroup[]): number {
  return toCardSections({ all: groups, groups })?.length ?? groups.length;
}

/** Before the first review there's nothing to relight yet, so Cards introduce themselves. */
function CardsIntro() {
  const t = useExtracted();
  const { hrefs } = useContentScreen();

  return (
    <div className="fun-glass flex flex-col items-center gap-3 rounded-3xl p-6 text-center">
      <GalleryVerticalEndIcon aria-hidden="true" className="text-fun-accent-cyan size-8" />
      <h2 className="font-fun-display text-lg font-bold">{t("Your cards are coming")}</h2>
      <p className="text-fun-fg2 text-sm">
        {t(
          "Every skill you learn becomes a card. They show up here after your first review, and glow again each time you remember them.",
        )}
      </p>
      <LearnLink className={buttonVariants({ variant: "lime" })} href={hrefs.capsules}>
        {t("Go to today")}
      </LearnLink>
    </div>
  );
}

/**
 * Fun's Cards: every skill a study card, grouped by area with today's capsules first, search,
 * filters with counts and flips. The same skills and states as Focus's list.
 */
export function FunCards() {
  const t = useExtracted();
  const { content } = useContentScreen();
  const filters = useCardFilters();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-fun-display text-3xl font-bold">{t("Cards")}</h1>
        <p className="text-fun-fg2 text-sm">
          {t(
            "{cards, plural, one {# card} other {# cards}} in {areas, plural, one {# area} other {# areas}}",
            { areas: countAreas(content.groups), cards: content.counts.total },
          )}
        </p>
      </header>

      <ReviewsDue />
      <ContentMapEntry />

      {content.reveal.cards ? (
        <>
          <CardFiltersBar
            filter={filters.filter}
            onFilterChange={filters.setFilter}
            onQueryChange={filters.setQuery}
            query={filters.query}
          />
          <FunCardGroups groups={filters.groups} isFiltering={filters.isFiltering} />
        </>
      ) : (
        <CardsIntro />
      )}

      <SummaryCards />
    </div>
  );
}
