import { AdminTableRow } from "@/components/admin-table-row";
import { formatDuration } from "@/lib/format-duration";
import { getAdminLessonKindLabel } from "@/lib/lesson-label";
import { Table, TableBody, TableCell, TableHead, TableHeader } from "@zoonk/ui/components/table";

type LessonBreakdownData = {
  kind: string;
  avgDuration: number;
  completionRate: number;
  completionCount: number;
};

export function LessonBreakdownTable({ data }: { data: LessonBreakdownData[] }) {
  return (
    <Table>
      <TableHeader>
        <AdminTableRow>
          <TableHead>Lesson type</TableHead>
          <TableHead>Avg duration</TableHead>
          <TableHead>Completion rate</TableHead>
          <TableHead numeric>Completions</TableHead>
        </AdminTableRow>
      </TableHeader>
      <TableBody>
        {data.length > 0 ? (
          data.map((row) => <LessonBreakdownRow key={row.kind} row={row} />)
        ) : (
          <AdminTableRow>
            <TableCell className="text-muted-foreground" colSpan={4}>
              No completed lessons in this period.
            </TableCell>
          </AdminTableRow>
        )}
      </TableBody>
    </Table>
  );
}

function LessonBreakdownRow({ row }: { row: LessonBreakdownData }) {
  return (
    <AdminTableRow>
      <TableCell className="font-medium">{getAdminLessonKindLabel(row.kind)}</TableCell>
      <TableCell className="tabular-nums">{formatDuration(row.avgDuration)}</TableCell>
      <TableCell>
        <CompletionBar rate={row.completionRate} />
      </TableCell>
      <TableCell numeric>{row.completionCount.toLocaleString()}</TableCell>
    </AdminTableRow>
  );
}

function CompletionBar({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-foreground/10 h-1.5 w-24 overflow-hidden rounded-full">
        <div
          className="bg-foreground/80 h-full rounded-full"
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span className="text-muted-foreground text-sm tabular-nums">{rate.toFixed(1)}%</span>
    </div>
  );
}
