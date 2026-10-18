import { buildAdminHref } from "@/lib/admin-href";
import { readEnumQueryParam, readQueryParam } from "@/lib/query-param";
import { LibraryVisibility, SourceKind } from "@zoonk/db";

type SearchParams = Awaited<PageProps<"/sources">["searchParams"]>;

type SourceListFilters = { kind?: SourceKind; search?: string; visibility?: LibraryVisibility };

/** Reads the source list filters from the URL, dropping values the list doesn't know. */
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

/** A filter link keeps the other filters and the search, and starts on the first page. */
export function buildSourceListHref(filters: SourceListFilters) {
  return buildAdminHref({ params: filters, path: "/sources" });
}
