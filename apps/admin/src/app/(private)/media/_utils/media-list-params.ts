import { buildAdminHref } from "@/lib/admin-href";
import { readEnumQueryParam } from "@/lib/query-param";
import { LibraryVisibility, MediaKind } from "@zoonk/db";

type SearchParams = Awaited<PageProps<"/media">["searchParams"]>;

type MediaListFilters = { kind?: MediaKind; visibility?: LibraryVisibility };

/** Reads the media list filters from the URL, dropping values the list doesn't know. */
export function parseMediaListFilters(params: SearchParams): MediaListFilters {
  return {
    kind: readEnumQueryParam({ allowed: Object.values(MediaKind), value: params.kind }),
    visibility: readEnumQueryParam({
      allowed: Object.values(LibraryVisibility),
      value: params.visibility,
    }),
  };
}

/** A filter link keeps the other filter and starts on the first page. */
export function buildMediaListHref(filters: MediaListFilters) {
  return buildAdminHref({ params: filters, path: "/media" });
}
