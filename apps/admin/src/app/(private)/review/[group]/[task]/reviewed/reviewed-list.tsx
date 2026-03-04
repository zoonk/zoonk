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
import { unmarkReviewedAction } from "./unmark-reviewed";

function ReviewedRow({
  entityId,
  reviewerName,
  reviewedAt,
  taskType,
}: {
  entityId: string;
  reviewerName: string;
  reviewedAt: string;
  taskType: string;
}) {
  return (
    <TableRow>
      <TableCell>{entityId}</TableCell>
      <TableCell>{reviewerName}</TableCell>
      <TableCell>{reviewedAt}</TableCell>
      <TableCell>
        <form action={unmarkReviewedAction}>
          <input type="hidden" name="taskType" value={taskType} />
          <input type="hidden" name="entityId" value={entityId} />
          <SubmitButton>Unmark</SubmitButton>
        </form>
      </TableCell>
    </TableRow>
  );
}

export async function ReviewedList({
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
    taskType,
  });
  const totalPages = Math.ceil(total / limit);

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No reviewed items yet.</p>;
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity ID</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead>Reviewed At</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {items.map((item) => (
              <ReviewedRow
                key={item.id.toString()}
                entityId={item.entityId.toString()}
                reviewerName={item.user.name}
                reviewedAt={item.reviewedAt.toLocaleDateString()}
                taskType={item.taskType}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath={`${getTaskPath(taskType)}/reviewed`}
        limit={limit}
        page={page}
        totalPages={totalPages}
      />
    </>
  );
}
