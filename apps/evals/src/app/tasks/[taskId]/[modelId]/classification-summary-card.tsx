import { type ClassificationSummary } from "@/lib/classification-metrics";
import { formatPercent } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@zoonk/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

function PerLabelAccuracy({ summary }: { summary: ClassificationSummary }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Expected label</TableHead>
          <TableHead>Correct</TableHead>
          <TableHead>Accuracy</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {summary.perLabel.map((item) => (
          <TableRow key={item.label}>
            <TableCell className="font-medium">{item.label}</TableCell>
            <TableCell>
              {item.correct}/{item.total}
            </TableCell>
            <TableCell>{formatPercent(item.accuracy)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Rows are the expected label and columns the predicted one; the diagonal is correct. */
function ConfusionMatrix({ summary }: { summary: ClassificationSummary }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Expected ↓ / Predicted →</TableHead>
          {summary.labels.map((label) => (
            <TableHead key={label}>{label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {summary.perLabel.map(({ label: expected }) => (
          <TableRow key={expected}>
            <TableCell className="font-medium">{expected}</TableCell>
            {summary.labels.map((predicted) => (
              <TableCell
                className={predicted === expected ? "font-semibold" : undefined}
                key={predicted}
              >
                {summary.counts[expected]?.[predicted] ?? 0}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ClassificationSummaryCard({ summary }: { summary: ClassificationSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Labels</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <PerLabelAccuracy summary={summary} />
        <ConfusionMatrix summary={summary} />
      </CardContent>
    </Card>
  );
}
