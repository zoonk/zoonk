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

export function getSkillListQueryParams(filters: SkillListFilters) {
  return {
    language: filters.language,
    merged: filters.includeMerged ? "show" : undefined,
    visibility: filters.visibility,
  };
}

export function buildSkillListHref(filters: SkillListFilters) {
  return buildAdminHref({
    params: { ...getSkillListQueryParams(filters), search: filters.search },
    path: "/skills",
  });
}
