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

export function UserPagination({
  page,
  limit,
  totalPages,
}: UserPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <Pagination className="mt-6">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
            href={page > 1 ? `/users?page=${page - 1}&limit=${limit}` : "#"}
          />
        </PaginationItem>

        {page > 2 && (
          <PaginationItem>
            <PaginationLink href={`/users?page=1&limit=${limit}`}>
              1
            </PaginationLink>
          </PaginationItem>
        )}

        {/* biome-ignore lint/style/noMagicNumbers: off */}
        {page > 3 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        {page > 1 && (
          <PaginationItem>
            <PaginationLink href={`/users?page=${page - 1}&limit=${limit}`}>
              {page - 1}
            </PaginationLink>
          </PaginationItem>
        )}

        <PaginationItem>
          <PaginationLink href="#" isActive>
            {page}
          </PaginationLink>
        </PaginationItem>

        {page < totalPages && (
          <PaginationItem>
            <PaginationLink href={`/users?page=${page + 1}&limit=${limit}`}>
              {page + 1}
            </PaginationLink>
          </PaginationItem>
        )}

        {page < totalPages - 2 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        {page < totalPages - 1 && (
          <PaginationItem>
            <PaginationLink href={`/users?page=${totalPages}&limit=${limit}`}>
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        )}

        <PaginationItem>
          <PaginationNext
            aria-disabled={page >= totalPages}
            className={
              page >= totalPages ? "pointer-events-none opacity-50" : ""
            }
            href={
              page < totalPages ? `/users?page=${page + 1}&limit=${limit}` : "#"
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
