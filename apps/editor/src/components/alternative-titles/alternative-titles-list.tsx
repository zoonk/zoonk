"use client";

import { Input } from "@zoonk/ui/components/input";
import { SearchIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { AlternativeTitleBadge } from "./alternative-title-badge";

export function AlternativeTitlesList({
  filteredTitles,
  hasMore,
  hiddenCount,
  onDelete,
  onSearch,
  onShowAll,
  onShowLess,
  search,
  showAll,
}: {
  filteredTitles: string[];
  hasMore: boolean;
  hiddenCount: number;
  onDelete: (slug: string) => void;
  onSearch: (value: string) => void;
  onShowAll: () => void;
  onShowLess: () => void;
  search: string;
  showAll: boolean;
}) {
  const t = useExtracted();

  return (
    <>
      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="h-8 pl-9 text-sm"
          onChange={(event) => onSearch(event.target.value)}
          placeholder={t("Search titles…")}
          value={search}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filteredTitles.map((slug) => (
          <AlternativeTitleBadge key={slug} onDelete={onDelete} slug={slug} />
        ))}
      </div>

      {hasMore && (
        <button
          className="text-muted-foreground hover:text-foreground text-xs hover:underline"
          onClick={onShowAll}
          type="button"
        >
          {t("and {count} more", { count: String(hiddenCount) })}
        </button>
      )}

      {showAll && !search.trim() && hiddenCount > 0 && (
        <button
          className="text-muted-foreground hover:text-foreground text-xs hover:underline"
          onClick={onShowLess}
          type="button"
        >
          {t("Show less")}
        </button>
      )}

      {search && filteredTitles.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("No titles match your search")}</p>
      )}
    </>
  );
}
