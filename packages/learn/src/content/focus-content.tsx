"use client";

import { useExtracted } from "next-intl";
import { CardFiltersBar } from "./card-filters-bar";
import { useContentScreen } from "./content-context";
import { ContentMapEntry } from "./content-map-links";
import { FocusSkillGroups } from "./focus-skill-groups";
import { ReviewsDue } from "./reviews-due";
import { SummaryCards } from "./summary-cards";
import { useCardFilters } from "./use-card-filters";

/**
 * Focus's Content: the goal's skills with their states (New, Learning, Solid, Mastered) grouped
 * by chapter, with search and filters, today's reviews and the saved lesson summaries.
 */
export function FocusContent() {
  const t = useExtracted();
  const { content } = useContentScreen();
  const filters = useCardFilters();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Skills")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("{total, plural, one {# skill} other {# skills}} · {mastered, number} mastered", {
            mastered: content.counts.mastered,
            total: content.counts.total,
          })}
        </p>
      </header>

      <ReviewsDue />
      <ContentMapEntry />

      <CardFiltersBar
        filter={filters.filter}
        onFilterChange={filters.setFilter}
        onQueryChange={filters.setQuery}
        query={filters.query}
      />

      <FocusSkillGroups groups={filters.groups} isFiltering={filters.isFiltering} />

      <SummaryCards />
    </div>
  );
}
