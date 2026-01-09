"use client";

import { Input } from "@zoonk/ui/components/input";
import { normalizeString } from "@zoonk/utils/string";
import { SearchIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useMemo, useState } from "react";
import type { ChapterWithLessons } from "@/data/chapters/list-course-chapters";
import { ChapterList } from "./chapter-list";

function filterChapters(chapters: ChapterWithLessons[], query: string) {
  const filtered: ChapterWithLessons[] = [];
  const toExpand: string[] = [];

  for (const chapter of chapters) {
    const chapterMatches = normalizeString(chapter.title).includes(query);
    const matchingLessons = chapter.lessons.filter((l) =>
      normalizeString(l.title).includes(query),
    );

    if (chapterMatches || matchingLessons.length > 0) {
      filtered.push({
        ...chapter,
        lessons: chapterMatches ? chapter.lessons : matchingLessons,
      });
      if (matchingLessons.length > 0) {
        toExpand.push(chapter.slug);
      }
    }
  }

  return { expandedSlugs: toExpand, filteredChapters: filtered };
}

export function ChapterSearchContainer({
  brandSlug,
  chapters,
  courseSlug,
}: {
  brandSlug: string;
  chapters: ChapterWithLessons[];
  courseSlug: string;
}) {
  return (
    <NuqsAdapter>
      <ChapterSearchContent
        brandSlug={brandSlug}
        chapters={chapters}
        courseSlug={courseSlug}
      />
    </NuqsAdapter>
  );
}

function ChapterSearchContent({
  brandSlug,
  chapters,
  courseSlug,
}: {
  brandSlug: string;
  chapters: ChapterWithLessons[];
  courseSlug: string;
}) {
  const t = useExtracted();
  const [search, setSearch] = useQueryState("q", {
    defaultValue: "",
    shallow: true,
    throttleMs: 300,
  });

  const [userExpanded, setUserExpanded] = useState<string[]>([]);

  const { filteredChapters, expandedSlugs } = useMemo(() => {
    const query = normalizeString(search);
    if (!query) {
      return { expandedSlugs: [], filteredChapters: chapters };
    }
    return filterChapters(chapters, query);
  }, [chapters, search]);

  const isSearchActive = search.trim().length > 0;
  const expandedValues = isSearchActive ? expandedSlugs : userExpanded;

  return (
    <>
      <div className="relative mb-4">
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          className="h-10 border-border/40 bg-transparent pl-9 placeholder:text-muted-foreground/50 focus-visible:border-border focus-visible:ring-0"
          onChange={(e) => setSearch(e.target.value || null)}
          placeholder={t("Search chapters and lessons...")}
          type="search"
          value={search}
        />
      </div>

      <ChapterList
        brandSlug={brandSlug}
        chapters={filteredChapters}
        courseSlug={courseSlug}
        emptyStateText={t("No chapters or lessons found")}
        expandedValues={expandedValues}
        onExpandedChange={(values) => {
          if (!isSearchActive) {
            setUserExpanded(values);
          }
        }}
      />
    </>
  );
}
