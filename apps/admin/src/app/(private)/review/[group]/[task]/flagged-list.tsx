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
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { unflagAction } from "./unflag-action";

function FlaggedRow({
  entityId,
  flaggedBy,
  flaggedAt,
  taskType,
}: {
  entityId: string;
  flaggedBy: string;
  flaggedAt: string;
  taskType: string;
}) {
  return (
    <TableRow>
      <TableCell>{entityId}</TableCell>
      <TableCell>{flaggedBy}</TableCell>
      <TableCell>{flaggedAt}</TableCell>
      <TableCell>
        <form action={unflagAction}>
          <input type="hidden" name="taskType" value={taskType} />
          <input type="hidden" name="entityId" value={entityId} />
          <SubmitButton>Return to queue</SubmitButton>
        </form>
      </TableCell>
    </TableRow>
  );
}

export async function FlaggedList({
  taskType,
  searchParams,
}: {
  taskType: ReviewTaskType;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { page, limit, offset } = parseSearchParams(await searchParams);
  const { items, total } = await listReviewedItems({
    limit,
    offset,
    status: "needsChanges",
    taskType,
  });
  const totalPages = Math.ceil(total / limit);

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
              <TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {items.map((item) => (
              <FlaggedRow
                key={item.id.toString()}
                entityId={item.entityId.toString()}
                flaggedBy={item.user.name}
                flaggedAt={item.reviewedAt.toLocaleDateString()}
                taskType={item.taskType}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath={`${getTaskPath(taskType)}?view=flagged`}
        limit={limit}
        page={page}
        totalPages={totalPages}
      />
    </>
  );
}
