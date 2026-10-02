"use client";

import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import { SearchIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useId } from "react";
import { useExperienceMode } from "../mode-provider";
import { CARD_FILTERS, type CardFilter } from "./card-filter";
import { useContentScreen } from "./content-context";

/** Fun's cards turn gold; Focus names the same state Mastered, as its skill list does. */
function useFilterLabels(isFun: boolean): Record<CardFilter, string> {
  const t = useExtracted();

  return {
    all: t("All"),
    fading: t("Fading"),
    gold: isFun ? t("Gold") : t("Mastered"),
    new: t("New"),
  };
}

/** Search and the All, Fading, Gold (Mastered in Focus) and New filters, each with its count. */
export function CardFiltersBar({
  filter,
  onFilterChange,
  onQueryChange,
  query,
}: {
  filter: CardFilter;
  onFilterChange: (filter: CardFilter) => void;
  onQueryChange: (query: string) => void;
  query: string;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const searchId = useId();
  const { content } = useContentScreen();
  const isFun = useExperienceMode() === "fun";
  const labels = useFilterLabels(isFun);
  const { counts } = content;

  const filterCounts: Record<CardFilter, number> = {
    all: counts.total,
    fading: counts.fading,
    gold: counts.mastered,
    new: counts.new,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <label className="sr-only" htmlFor={searchId}>
          {t("Search skills")}
        </label>
        <SearchIcon
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2"
        />
        <Input
          className="in-data-[mode=fun]:fun-glass h-11 rounded-full pl-10"
          id={searchId}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={
            isFun
              ? t("{count, plural, one {Search # card} other {Search # cards}}", {
                  count: counts.total,
                })
              : t("{count, plural, one {Search # skill} other {Search # skills}}", {
                  count: counts.total,
                })
          }
          type="search"
          value={query}
        />
      </div>

      <div
        aria-label={t("Show")}
        className="bg-muted in-data-[mode=fun]:fun-glass grid grid-cols-4 gap-1 rounded-2xl p-1"
        role="group"
      >
        {CARD_FILTERS.map((item) => (
          <button
            aria-pressed={filter === item}
            className={cn(
              "focus-visible:ring-ring/50 flex min-h-11 flex-col items-center justify-center rounded-xl px-1 py-1 outline-none focus-visible:ring-[3px]",
              filter === item
                ? "bg-background in-data-[mode=fun]:fun-inv shadow-sm"
                : "text-muted-foreground",
            )}
            key={item}
            onClick={() => onFilterChange(item)}
            type="button"
          >
            <span className="text-sm font-semibold tabular-nums">
              {format.number(filterCounts[item])}
            </span>
            <span className="text-xs">{labels[item]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
