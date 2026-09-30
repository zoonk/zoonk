"use client";

import { useDeferredValue, useState } from "react";
import { type CardFilter, filterCardGroups } from "./card-filter";
import { useContentScreen } from "./content-context";

/**
 * Search and filter state shared by Focus's skill list and Fun's Cards. Typing stays instant with a
 * thousand cards because the filtering follows a deferred copy of the query.
 */
export function useCardFilters() {
  const { content } = useContentScreen();
  const [filter, setFilter] = useState<CardFilter>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const groups = filterCardGroups({ filter, groups: content.groups, query: deferredQuery });
  const isFiltering = filter !== "all" || deferredQuery.trim().length > 0;

  return { filter, groups, isFiltering, query, setFilter, setQuery };
}
