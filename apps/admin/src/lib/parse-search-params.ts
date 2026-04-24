const DEFAULT_PAGE_SIZE = 50;

export function parseSearchParams(params: Partial<Record<string, string | string[]>>): {
  page: number;
  limit: number;
  offset: number;
  search?: string;
} {
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * limit;
  const search = Array.isArray(params.search) ? params.search[0] : params.search;

  return { limit, offset, page, search };
}
