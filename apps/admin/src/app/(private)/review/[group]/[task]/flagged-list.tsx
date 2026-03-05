import { AdminPagination } from "@/components/pagination";
import { listReviewedItems } from "@/data/review/list-reviewed-items";
import { parseSearchParams } from "@/lib/parse-search-params";
import { type ReviewTaskType, getTaskPath } from "@/lib/review-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import Link from "next/link";

function FlaggedRow({
  entityId,
  flaggedBy,
  flaggedAt,
  taskPath,
}: {
  entityId: string;
  flaggedBy: string;
  flaggedAt: string;
  taskPath: string;
}) {
  return (
    <TableRow>
      <TableCell>
        <Link href={`${taskPath}/${entityId}`} className="underline">
          {entityId}
        </Link>
      </TableCell>
      <TableCell>{flaggedBy}</TableCell>
      <TableCell>{flaggedAt}</TableCell>
    </TableRow>
  );
}

export async function FlaggedList({
  taskType,
  searchParams,
}: {
  taskType: ReviewTaskType;
  searchParams: PageProps<"/review/[group]/[task]">["searchParams"];
}) {
  const { page, limit, offset } = parseSearchParams(await searchParams);
  const { items, total } = await listReviewedItems({
    limit,
    offset,
    status: "needsChanges",
    taskType,
  });
  const totalPages = Math.ceil(total / limit);

  const taskPath = getTaskPath(taskType);

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No flagged items.</p>;
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity ID</TableHead>
              <TableHead>Flagged by</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {items.map((item) => (
              <FlaggedRow
                key={item.id.toString()}
                entityId={item.entityId.toString()}
                flaggedBy={item.user.name}
                flaggedAt={item.reviewedAt.toLocaleDateString()}
                taskPath={taskPath}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath={`${taskPath}?view=flagged`}
        limit={limit}
        page={page}
        totalPages={totalPages}
      />
    </>
  );
}
