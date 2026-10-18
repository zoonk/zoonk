import { readQueryParam } from "@/lib/query-param";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE = 1;
const MIN_PAGE_SIZE = 1;

type SearchParamValue = string | string[] | undefined;

export function parseSearchParams(params: Partial<Record<string, string | string[]>>): {
  page: number;
  limit: number;
  offset: number;
  search?: string;
} {
  const page = parsePageNumber(params.page);
  const limit = parsePageSize(params.limit);
  const offset = (page - 1) * limit;
  const search = readQueryParam(params.search);

  return { limit, offset, page, search };
}

/**
 * Admin pagination query params are user-controlled strings. Coercing the page
 * here guarantees every Prisma `skip` value is a non-negative integer.
 */
function parsePageNumber(value: SearchParamValue): number {
  const page = parseIntegerParam(value);

  if (page === null) {
    return MIN_PAGE;
  }

  return Math.max(page, MIN_PAGE);
}

/**
 * Prisma `take` must stay finite and bounded. A maximum keeps admin list pages
 * from becoming accidental unbounded queries when someone edits the URL.
 */
function parsePageSize(value: SearchParamValue): number {
  const pageSize = parseIntegerParam(value);

  if (pageSize === null) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(pageSize, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
}

/**
 * Query params can arrive as arrays and can contain decimals, infinities, or
 * arbitrary text. This keeps only finite integer intent and lets callers decide
 * which default or bounds make sense for that field.
 */
function parseIntegerParam(value: SearchParamValue): number | null {
  const firstValue = readQueryParam(value);
  const trimmedValue = firstValue?.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return Math.trunc(parsedValue);
}
