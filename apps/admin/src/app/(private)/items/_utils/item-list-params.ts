import { readEnumQueryParam, readQueryParam } from "@/lib/query-param";
import { ItemFormat } from "@zoonk/db";
import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";

type SearchParams = Awaited<PageProps<"/items">["searchParams"]>;

export function parseItemListFilters(params: SearchParams) {
  return {
    format: readEnumQueryParam({ allowed: Object.values(ItemFormat), value: params.format }),
    language: readEnumQueryParam({ allowed: SUPPORTED_LOCALES, value: params.language }),
    search: readQueryParam(params.search),
  };
}
