"use server";

import { searchCatalog } from "@zoonk/core/catalog/search";

/**
 * Keeps the command palette's server boundary limited to forwarding search
 * input while core owns the reusable catalog behavior and result shape.
 */
export async function searchCatalogAction(params: { query: string; language: string }) {
  return searchCatalog(params);
}
