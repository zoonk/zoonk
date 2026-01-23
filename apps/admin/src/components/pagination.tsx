import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@zoonk/ui/components/pagination";

type AdminPaginationProps = {
  basePath: string;
  page: number;
  limit: number;
  totalPages: number;
  search?: string;
};

function buildPageUrl(
  basePath: string,
  pageNumber: number,
  limit: number,
  search?: string,
): string {
  const params = new URLSearchParams();
  params.set("page", pageNumber.toString());
  params.set("limit", limit.toString());

  if (search) {
    params.set("search", search);
  }

  return `${basePath}?${params.toString()}`;
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
}: AdminPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;
  const visiblePages = getVisiblePageNumbers(page, totalPages);
  const pagesWithEllipses = addEllipsesToPages(visiblePages);

  return (
    <Pagination className="mt-6">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={isFirstPage}
            className={isFirstPage ? "pointer-events-none opacity-50" : ""}
            href={isFirstPage ? "#" : buildPageUrl(basePath, page - 1, limit, search)}
          />
        </PaginationItem>

        {pagesWithEllipses.map((pageOrEllipsis, index) => (
          <PaginationItem key={`${pageOrEllipsis}-${index}`}>
            {pageOrEllipsis === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href={
                  pageOrEllipsis === page
                    ? "#"
                    : buildPageUrl(basePath, pageOrEllipsis, limit, search)
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
            href={isLastPage ? "#" : buildPageUrl(basePath, page + 1, limit, search)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
