import { getAdminLessonKindLabel } from "@/lib/lesson-label";
import { type LessonKind } from "@zoonk/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

type CompletedLessonKindCount = { count: number; kind: LessonKind };

/**
 * Content stats need to separate total lesson volume from lessons that are
 * actually generated and ready. Grouping completed lessons by kind makes gaps
 * in the generation pipeline visible without changing the existing totals.
 */
export function CompletedLessonsByKindTable({
  lessonsByKind,
}: {
  lessonsByKind: CompletedLessonKindCount[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kind</TableHead>
          <TableHead className="text-right">Completed Lessons</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {lessonsByKind.length > 0 ? (
          lessonsByKind.map((row) => <CompletedLessonKindRow key={row.kind} row={row} />)
        ) : (
          <TableRow>
            <TableCell className="text-muted-foreground" colSpan={2}>
              No completed lessons yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/**
 * Each grouped row applies the same kind label used by review and lesson logs,
 * so internal admin pages describe generated lesson types consistently.
 */
function CompletedLessonKindRow({ row }: { row: CompletedLessonKindCount }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{getAdminLessonKindLabel(row.kind)}</TableCell>
      <TableCell className="text-right tabular-nums">{row.count.toLocaleString()}</TableCell>
    </TableRow>
  );
}
