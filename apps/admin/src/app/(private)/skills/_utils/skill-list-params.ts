import { buildAdminHref } from "@/lib/admin-href";
import { readEnumQueryParam, readQueryParam } from "@/lib/query-param";
import { LibraryVisibility } from "@zoonk/db";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";

type SearchParams = Awaited<PageProps<"/skills">["searchParams"]>;

type SkillListFilters = {
  includeMerged: boolean;
  language?: string;
  search?: string;
  visibility?: LibraryVisibility;
};

/** Reads the skill list filters from the URL, dropping values the list doesn't know. */
export function parseSkillListFilters(params: SearchParams): SkillListFilters {
  return {
    includeMerged: readQueryParam(params.merged) === "show",
    language: readEnumQueryParam({ allowed: SUPPORTED_LOCALES, value: params.language }),
    search: readQueryParam(params.search),
    visibility: readEnumQueryParam({
      allowed: Object.values(LibraryVisibility),
      value: params.visibility,
    }),
  };
}

/** The filters as query params, for pagination links. */
export function getSkillListQueryParams(filters: SkillListFilters) {
  return {
    language: filters.language,
    merged: filters.includeMerged ? "show" : undefined,
    visibility: filters.visibility,
  };
}

/**
 * A filter link keeps every other filter and the search, and drops the page so
 * the new result set opens on its first page.
 */
export function buildSkillListHref(filters: SkillListFilters) {
  return buildAdminHref({
    params: { ...getSkillListQueryParams(filters), search: filters.search },
    path: "/skills",
  });
}
