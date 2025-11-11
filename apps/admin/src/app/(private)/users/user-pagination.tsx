import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@zoonk/ui/components/pagination";

type UserPaginationProps = {
  page: number;
  limit: number;
  totalPages: number;
};

function buildUserPageUrl(pageNumber: number, limit: number): string {
  return `/users?page=${pageNumber}&limit=${limit}`;
}

function getVisiblePageNumbers(
  currentPage: number,
  totalPages: number,
): number[] {
  return Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (pageNumber) =>
      pageNumber === 1 ||
      pageNumber === totalPages ||
      Math.abs(pageNumber - currentPage) <= 1,
  );
}

function addEllipsesToPages(pageNumbers: number[]): (number | "ellipsis")[] {
  return pageNumbers.flatMap((pageNumber, index, allPages) => {
    const previousPage = allPages[index - 1];
    const hasGap = index > 0 && pageNumber - previousPage > 1;
    return hasGap ? (["ellipsis", pageNumber] as const) : [pageNumber];
  });
}

export function UserPagination({
  page,
  limit,
  totalPages,
}: UserPaginationProps) {
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
            href={isFirstPage ? "#" : buildUserPageUrl(page - 1, limit)}
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
                    : buildUserPageUrl(pageOrEllipsis, limit)
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
            href={isLastPage ? "#" : buildUserPageUrl(page + 1, limit)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
