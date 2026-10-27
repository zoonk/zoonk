import { withApiErrorBoundary } from "@/lib/api-handler";
import { toCatalogSearchResponse } from "@/lib/catalog-responses";
import { catalogSearchQuerySchema } from "@/lib/openapi/schemas/catalog-resources";
import { readQueryParams } from "@/lib/request-input";
import { searchCatalog } from "@zoonk/core/catalog/search";
import { NextResponse } from "next/server";

/**
 * Searches published course and chapter resources as the bounded cross-catalog
 * capability used by command palettes, native search, CLI clients, and agents.
 */
async function getCatalogSearch(request: Request) {
  const parsed = readQueryParams(request, catalogSearchQuerySchema);

  const results = await searchCatalog(parsed);
  return NextResponse.json(toCatalogSearchResponse(results));
}

export const GET = withApiErrorBoundary(getCatalogSearch);
