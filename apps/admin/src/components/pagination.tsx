import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@zoonk/ui/components/pagination";

type PaginationQueryParams = Record<string, string | undefined>;
type PaginationEntry = [string, string | undefined] | undefined;

/**
 * Pagination links need to carry page state plus route-specific filters, such
 * as the generated lesson status, while dropping empty query values.
 */
function buildPageUrl({
  basePath,
  limit,
  pageNumber,
  queryParams,
  search,
}: {
  basePath: string;
  limit: number;
  pageNumber: number;
  queryParams?: PaginationQueryParams;
  search?: string;
}): string {
  const rawEntries: PaginationEntry[] = [
    ...Object.entries(queryParams ?? {}),
    ["page", pageNumber.toString()],
    ["limit", limit.toString()],
    search ? ["search", search] : undefined,
  ];

  const entries = rawEntries.filter((entry) => isPaginationEntry(entry));

  return `${basePath}?${new URLSearchParams(entries).toString()}`;
}

/**
 * URLSearchParams only accepts complete string pairs. This guard lets callers
 * build declarative conditional arrays without leaking falsey placeholders.
 */
function isPaginationEntry(entry: PaginationEntry): entry is [string, string] {
  return Array.isArray(entry) && Boolean(entry[1]);
}

function getVisiblePageNumbers(currentPage: number, totalPages: number): number[] {
  return Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (pageNumber) =>
      pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - currentPage) <= 1,
  );
}

function addEllipsesToPages(pageNumbers: number[]): (number | "ellipsis")[] {
  return pageNumbers.flatMap((pageNumber, index, allPages) => {
    const previousPage = allPages[index - 1];
    const hasGap = previousPage !== undefined && pageNumber - previousPage > 1;
    return hasGap ? (["ellipsis", pageNumber] as const) : [pageNumber];
  });
}

export function AdminPagination({
  basePath,
  page,
  limit,
  totalPages,
  search,
  queryParams,
}: {
  basePath: string;
  page: number;
  limit: number;
  totalPages: number;
  search?: string;
  queryParams?: PaginationQueryParams;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;
  const visiblePages = getVisiblePageNumbers(page, totalPages);
  const pagesWithEllipses = addEllipsesToPages(visiblePages);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={isFirstPage}
            className={isFirstPage ? "pointer-events-none opacity-50" : ""}
            href={
              isFirstPage
                ? "#"
                : buildPageUrl({ basePath, limit, pageNumber: page - 1, queryParams, search })
            }
          />
        </PaginationItem>

        {pagesWithEllipses.map((pageOrEllipsis, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- Page numbers/ellipses can repeat, no unique ID
          <PaginationItem key={`${pageOrEllipsis}-${index}`}>
            {pageOrEllipsis === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href={
                  pageOrEllipsis === page
                    ? "#"
                    : buildPageUrl({
                        basePath,
                        limit,
                        pageNumber: pageOrEllipsis,
                        queryParams,
                        search,
                      })
                }
                isActive={pageOrEllipsis === page}
              >
                {pageOrEllipsis}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            aria-disabled={isLastPage}
            className={isLastPage ? "pointer-events-none opacity-50" : ""}
            href={
              isLastPage
                ? "#"
                : buildPageUrl({ basePath, limit, pageNumber: page + 1, queryParams, search })
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
