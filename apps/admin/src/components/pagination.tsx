import { type AdminQueryParams, buildAdminHref } from "@/lib/admin-href";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@zoonk/ui/components/pagination";
import Link from "next/link";

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
  queryParams?: AdminQueryParams;
  search?: string;
}): string {
  return buildAdminHref({
    params: { ...queryParams, limit: limit.toString(), page: pageNumber.toString(), search },
    path: basePath,
  });
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

/**
 * Every available page is prefetched so pagination can switch URL-backed admin
 * data without waiting for a server round trip after the click.
 */
function AdminPaginationPageLink({
  basePath,
  currentPage,
  limit,
  pageNumber,
  queryParams,
  search,
}: {
  basePath: string;
  currentPage: number;
  limit: number;
  pageNumber: number;
  queryParams?: AdminQueryParams;
  search?: string;
}) {
  const isActive = pageNumber === currentPage;

  const href = isActive
    ? undefined
    : buildPageUrl({ basePath, limit, pageNumber, queryParams, search });

  return (
    <PaginationLink
      href={href ?? "#"}
      isActive={isActive}
      render={href ? <Link href={href} prefetch /> : undefined}
    >
      {pageNumber}
    </PaginationLink>
  );
}

export function AdminPagination({
  basePath,
  limit,
  page,
  queryParams,
  search,
  totalPages,
}: {
  basePath: string;
  limit: number;
  page: number;
  queryParams?: AdminQueryParams;
  search?: string;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;
  const visiblePages = getVisiblePageNumbers(page, totalPages);
  const pagesWithEllipses = addEllipsesToPages(visiblePages);

  const previousHref = isFirstPage
    ? undefined
    : buildPageUrl({ basePath, limit, pageNumber: page - 1, queryParams, search });

  const nextHref = isLastPage
    ? undefined
    : buildPageUrl({ basePath, limit, pageNumber: page + 1, queryParams, search });

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={isFirstPage}
            className={isFirstPage ? "pointer-events-none opacity-50" : ""}
            href={previousHref ?? "#"}
            render={previousHref ? <Link href={previousHref} prefetch /> : undefined}
          />
        </PaginationItem>

        {pagesWithEllipses.map((pageOrEllipsis, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- Page numbers/ellipses can repeat, no unique ID
          <PaginationItem key={`${pageOrEllipsis}-${index}`}>
            {pageOrEllipsis === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <AdminPaginationPageLink
                basePath={basePath}
                currentPage={page}
                limit={limit}
                pageNumber={pageOrEllipsis}
                queryParams={queryParams}
                search={search}
              />
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            aria-disabled={isLastPage}
            className={isLastPage ? "pointer-events-none opacity-50" : ""}
            href={nextHref ?? "#"}
            render={nextHref ? <Link href={nextHref} prefetch /> : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
