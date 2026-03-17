import { formatDuration } from "@/lib/format-duration";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

const activityKindLabels: Record<string, string> = {
  challenge: "Challenge",
  custom: "Custom",
  explanation: "Explanation",
  grammar: "Grammar",

  listening: "Listening",
  practice: "Practice",
  quiz: "Quiz",
  reading: "Reading",
  review: "Review",
  translation: "Translation",
  vocabulary: "Vocabulary",
};

type ActivityBreakdownRow = {
  kind: string;
  avgDuration: number;
  completionRate: number;
  completionCount: number;
};

export function ActivityBreakdownTable({ data }: { data: ActivityBreakdownRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Activity Type</TableHead>
          <TableHead>Avg Duration</TableHead>
          <TableHead>Completion Rate</TableHead>
          <TableHead className="text-right">Completions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <ActivityBreakdownRow key={row.kind} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}

function ActivityBreakdownRow({ row }: { row: ActivityBreakdownRow }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{activityKindLabels[row.kind] ?? row.kind}</TableCell>
      <TableCell className="tabular-nums">{formatDuration(row.avgDuration)}</TableCell>
      <TableCell>
        <CompletionBar rate={row.completionRate} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.completionCount.toLocaleString()}
      </TableCell>
    </TableRow>
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
