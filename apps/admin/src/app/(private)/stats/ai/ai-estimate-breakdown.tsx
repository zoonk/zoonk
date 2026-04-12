import {
  type AiGenerationCostEstimate,
  type EstimateLineItem,
} from "@/data/stats/ai/get-ai-cost-estimates";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@zoonk/ui/components/accordion";
import { Badge } from "@zoonk/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { formatAiCost } from "./format-ai-cost";

/**
 * The top estimate cards answer the big questions quickly, but admins still
 * need a way to inspect the math behind each total before trusting it.
 */
export function AiEstimateBreakdown({
  estimates,
  summaries,
}: {
  estimates: AiGenerationCostEstimate[];
  summaries: Record<string, string>;
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold tracking-tight">Estimate Breakdown</h2>
        <p className="text-muted-foreground/70 text-sm">
          Each estimate shows the average requests per workflow, the historical average cost per
          request, and any inferred cost that sits outside Gateway reporting.
        </p>
      </header>

      <Accordion multiple variant="default">
        {estimates.map((estimate) => (
          <AccordionItem key={estimate.kind} value={estimate.kind}>
            <AccordionTrigger>
              <EstimateSummary estimate={estimate} summary={summaries[estimate.kind] ?? ""} />
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-xl border">
                <EstimateLineItemTable items={estimate.lineItems} />
              </div>

              {estimate.notes.length > 0 ? (
                <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm">
                  {estimate.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

/**
 * Accordion headers need to summarize both the workflow name and the current
 * total so admins can scan the full section without opening every item.
 */
function EstimateSummary({
  estimate,
  summary,
}: {
  estimate: AiGenerationCostEstimate;
  summary: string;
}) {
  return (
    <div className="flex w-full flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-foreground text-sm font-medium">{estimate.title}</span>
        <span className="text-muted-foreground text-sm">{estimate.description}</span>
      </div>

      <div className="flex flex-col items-end gap-1 text-right">
        <span className="text-foreground text-base font-medium tabular-nums">
          {formatAiCost(estimate.totalEstimatedCost)}
        </span>
        <span className="text-muted-foreground text-sm">{summary}</span>
      </div>
    </div>
  );
}

/**
 * The estimate details are easiest to compare as a table because admins often
 * need to see which task dominates the total and whether a row is inferred or
 * missing direct cost data.
 */
function EstimateLineItemTable({ items }: { items: EstimateLineItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Component</TableHead>
          <TableHead className="text-right">Avg Requests / Run</TableHead>
          <TableHead className="text-right">Avg Cost / Request</TableHead>
          <TableHead className="text-right">Estimated Cost</TableHead>
          <TableHead className="text-right">Source</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {items.map((item) => (
          <TableRow key={item.taskName ?? item.label}>
            <TableCell className="align-top">
              <div className="flex flex-col gap-1">
                <span className="font-medium">{item.label}</span>
                {item.note ? (
                  <span className="text-muted-foreground text-sm">{item.note}</span>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="text-right align-top tabular-nums">
              {formatEstimateRatio(item.averageRequestsPerRun)}
            </TableCell>
            <TableCell className="text-right align-top tabular-nums">
              {item.averageCostPerRequest > 0 ? formatAiCost(item.averageCostPerRequest) : "—"}
            </TableCell>
            <TableCell className="text-right align-top tabular-nums">
              {formatAiCost(item.estimatedCost)}
            </TableCell>
            <TableCell className="align-top">
              <LineItemSource item={item} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Gateway-backed rows and inferred rows should be distinguishable at a glance,
 * and missing cost coverage should stand out because it directly affects how
 * complete the total estimate is.
 */
function LineItemSource({ item }: { item: EstimateLineItem }) {
  return (
    <div className="flex justify-end gap-2">
      <Badge variant={item.isInferred ? "outline" : "secondary"}>
        {item.isInferred ? "Inferred" : "Gateway"}
      </Badge>

      {item.hasUsageData ? null : <Badge variant="outline">No cost data</Badge>}
    </div>
  );
}

/**
 * Request counts can be fractional once we average them across many lessons or
 * courses. This formatter keeps the numbers compact without hiding smaller
 * differences in workflow shape.
 */
function formatEstimateRatio(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
  }).format(value);
}
