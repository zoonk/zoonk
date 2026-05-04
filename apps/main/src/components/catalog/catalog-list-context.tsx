"use client";

import { createContext, use } from "react";

type CatalogListContextValue = { filteredIds: Set<string> | null; isSearchActive: boolean };

export const CatalogListContext = createContext<CatalogListContextValue | null>(null);

/**
 * Search filtering is shared by catalog rows, so row wrappers can stay focused
 * on visibility instead of duplicating query parsing.
 */
export function useCatalogListContext() {
  return use(CatalogListContext);
}
