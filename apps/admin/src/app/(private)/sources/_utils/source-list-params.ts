import { buildAdminHref } from "@/lib/admin-href";
import { readEnumQueryParam, readQueryParam } from "@/lib/query-param";
import { LibraryVisibility, SourceKind } from "@zoonk/db";

type SearchParams = Awaited<PageProps<"/sources">["searchParams"]>;

type SourceListFilters = { kind?: SourceKind; search?: string; visibility?: LibraryVisibility };

export function parseSourceListFilters(params: SearchParams): SourceListFilters {
  return {
    kind: readEnumQueryParam({ allowed: Object.values(SourceKind), value: params.kind }),
    search: readQueryParam(params.search),
    visibility: readEnumQueryParam({
      allowed: Object.values(LibraryVisibility),
      value: params.visibility,
    }),
  };
}

export function buildSourceListHref(filters: SourceListFilters) {
  return buildAdminHref({ params: filters, path: "/sources" });
}
