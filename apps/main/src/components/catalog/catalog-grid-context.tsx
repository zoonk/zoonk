"use client";

import { createContext, use } from "react";

type CatalogGridContextValue = { filteredIds: Set<string> | null; isSearchActive: boolean };

export const CatalogGridContext = createContext<CatalogGridContextValue | null>(null);

/**
 * Grid children read the active search filter from this hook so links and empty
 * states can stay declarative instead of passing filtered ids through every map.
 */
export function useCatalogGridContext() {
  return use(CatalogGridContext);
}
