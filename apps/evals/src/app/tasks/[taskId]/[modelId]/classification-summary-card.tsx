import { type ClassificationSummary } from "@/lib/classification-metrics";
import { formatPercent } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDownIcon, ArrowRightIcon } from "lucide-react";

/** Both tables share these widths, so their columns start and end on the same lines. */
const LABEL_COLUMN = "w-64";
const NUMBER_COLUMN = "w-32 px-0 text-right";

function PerLabelAccuracy({ summary }: { summary: ClassificationSummary }) {
  return (
    <Table className="w-auto">
      <TableHeader>
        <TableRow>
          <TableHead className={LABEL_COLUMN}>Expected label</TableHead>
          <TableHead className={NUMBER_COLUMN}>Correct</TableHead>
          <TableHead className={NUMBER_COLUMN}>Accuracy</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {summary.perLabel.map((item) => (
          <TableRow key={item.label}>
            <TableCell className="font-medium">{item.label}</TableCell>
            <TableCell className={NUMBER_COLUMN}>
              {item.correct}/{item.total}
            </TableCell>
            <TableCell className={NUMBER_COLUMN}>{formatPercent(item.accuracy)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ConfusionMatrix({ summary }: { summary: ClassificationSummary }) {
  return (
    <Table className="w-auto">
      <TableHeader>
        <TableRow>
          <TableHead className={LABEL_COLUMN}>
            <span className="inline-flex items-center gap-1">
              Expected
              <ArrowDownIcon aria-hidden="true" className="size-3.5" />
              <span className="px-1">/</span>
              Predicted
              <ArrowRightIcon aria-hidden="true" className="size-3.5" />
            </span>
          </TableHead>
          {summary.labels.map((label) => (
            <TableHead className={NUMBER_COLUMN} key={label}>
              {label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {summary.perLabel.map(({ label: expected }) => (
          <TableRow key={expected}>
            <TableCell className="font-medium">{expected}</TableCell>
            {summary.labels.map((predicted) => (
              <TableCell
                className={cn(NUMBER_COLUMN, predicted === expected && "font-semibold")}
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
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Labels</h2>
      <PerLabelAccuracy summary={summary} />
      <ConfusionMatrix summary={summary} />
    </section>
  );
}
