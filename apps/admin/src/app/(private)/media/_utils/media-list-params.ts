import { buildAdminHref } from "@/lib/admin-href";
import { readEnumQueryParam } from "@/lib/query-param";
import { LibraryVisibility, MediaKind } from "@zoonk/db";

type SearchParams = Awaited<PageProps<"/media">["searchParams"]>;

type MediaListFilters = { kind?: MediaKind; visibility?: LibraryVisibility };

export function parseMediaListFilters(params: SearchParams): MediaListFilters {
  return {
    kind: readEnumQueryParam({ allowed: Object.values(MediaKind), value: params.kind }),
    visibility: readEnumQueryParam({
      allowed: Object.values(LibraryVisibility),
      value: params.visibility,
    }),
  };
}

export function buildMediaListHref(filters: MediaListFilters) {
  return buildAdminHref({ params: filters, path: "/media" });
}
