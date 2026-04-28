import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

export function ContentTotalsTable({
  totals,
  periodCreated,
}: {
  totals: { courses: number; chapters: number; lessons: number; steps: number };
  periodCreated: { courses: number; lessons: number };
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Created This Period</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        <ContentRow count={periodCreated.courses} title="Courses" total={totals.courses} />
        <ContentRow title="Chapters" total={totals.chapters} />
        <ContentRow count={periodCreated.lessons} title="Lessons" total={totals.lessons} />
        <ContentRow title="Steps" total={totals.steps} />
      </TableBody>
    </Table>
  );
}

function ContentRow({ title, total, count }: { title: string; total: number; count?: number }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{title}</TableCell>
      <TableCell className="text-right tabular-nums">{total.toLocaleString()}</TableCell>
      <TableCell className="text-right tabular-nums">
        {count === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          count.toLocaleString()
        )}
      </TableCell>
    </TableRow>
  );
}
