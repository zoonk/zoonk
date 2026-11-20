import { type Decision } from "@/lib/comparisons/decision";
import { type Comparison } from "@/lib/comparisons/schemas";
import { formatDollars, formatSeconds } from "@/lib/format";
import { SCROLL_LABELS } from "@/lib/scroll-labels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import {
  SIDE_LABELS,
  STATUS_LABELS,
  formatDate,
  languageName,
  pipelineNote,
  variantName,
} from "../_utils/labels";
import { plural } from "../_utils/words";

type Row = Decision["rows"][number];

function CaseLinks({ both, caseIds }: { both: string[]; caseIds: string[] }) {
  if (caseIds.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }

  return (
    <span className="flex flex-col gap-1">
      {caseIds.map((caseId) => (
        <a
          className="font-mono text-xs underline underline-offset-4"
          href={`#case-${encodeURIComponent(caseId)}`}
          key={caseId}
        >
          {caseId}
          {both.includes(caseId) && <span className="text-muted-foreground"> (both sides)</span>}
        </a>
      ))}
    </span>
  );
}

function qualityCell(row: Row, criterion: string) {
  const metrics = row.quality.filter((metric) => metric.criterion === criterion);

  return (
    <CaseLinks
      both={metrics.flatMap((metric) => metric.both)}
      caseIds={metrics.flatMap((metric) => metric.affected)}
    />
  );
}

function DeliveryByLanguage({
  row,
  value,
}: {
  row: Row;
  value: (delivery: Row["deliveryByLanguage"][string]) => string;
}) {
  const languages = Object.entries(row.deliveryByLanguage);

  if (languages.length < 2) {
    return null;
  }

  return (
    <span className="text-muted-foreground block text-xs">
      {languages
        .map(([language, delivery]) => `${languageName(language)} ${value(delivery)}`)
        .join(" · ")}
    </span>
  );
}

function FactRow({
  cell,
  label,
  rows,
}: {
  cell: (row: Row) => React.ReactNode;
  label: React.ReactNode;
  rows: Row[];
}) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground align-top whitespace-normal">{label}</TableCell>
      {rows.map((row) => (
        <TableCell className="align-top whitespace-normal" key={row.side}>
          {cell(row)}
        </TableCell>
      ))}
    </TableRow>
  );
}

function statusCell(row: Row) {
  return <span className="font-medium">{STATUS_LABELS[row.status]}</span>;
}

function preferredCell(row: Row) {
  return `${row.wins} won · ${row.losses} lost`;
}

function deliveredCell(row: Row) {
  const delivered = `${row.succeeded} of ${row.attempted}`;

  return row.missingMatches > 0
    ? `${delivered} · ${plural(row.missingMatches, "missing match", "missing matches")}`
    : delivered;
}

function costCell(row: Row) {
  return (
    <>
      <span className="font-mono">{formatDollars(row.costPer1000)}</span>
      <DeliveryByLanguage row={row} value={(delivery) => formatDollars(delivery.costPer1000)} />
    </>
  );
}

function waitText(delivery: { p50: number | null; p95: number | null }) {
  return `${formatSeconds(delivery.p50)} / ${formatSeconds(delivery.p95)}`;
}

function waitCell(row: Row) {
  return (
    <>
      <span className="font-mono">{waitText(row)}</span>
      <DeliveryByLanguage row={row} value={waitText} />
    </>
  );
}

function GroupRow({ label }: { label: string }) {
  return (
    <TableRow className="border-b-0">
      <TableCell className="pt-5 font-medium whitespace-normal" colSpan={3}>
        {label}
      </TableCell>
    </TableRow>
  );
}

/** Both sides on the matched cases: what they delivered, how readers judged them, what they cost. */
export function DecisionTable({
  decision,
  manifest,
}: {
  decision: Decision;
  manifest: Comparison["manifest"];
}) {
  const rows = (["incumbent", "challenger"] as const).flatMap((side) => {
    const row = decision.rows.find((entry) => entry.side === side);
    return row ? [row] : [];
  });

  const [first] = rows;
  const counts = first ? Object.entries(first.casesByLanguage) : [];

  return (
    <div className="flex flex-col gap-2">
      <Table scrollLabels={SCROLL_LABELS}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/4" />
            {rows.map((row) => {
              const variant = manifest.variants[row.side];

              return (
                <TableHead
                  className="text-foreground align-bottom whitespace-normal"
                  key={row.side}
                >
                  <span className="block text-sm font-medium">{SIDE_LABELS[row.side]}</span>
                  <span className="text-muted-foreground font-mono text-xs font-normal">
                    {variant && variantName(variant)}
                  </span>
                  {variant && pipelineNote(variant) && (
                    <span className="text-muted-foreground block text-xs font-normal">
                      {pipelineNote(variant)}
                    </span>
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          <FactRow cell={statusCell} label="Status" rows={rows} />
          <FactRow cell={preferredCell} label="Readers preferred it" rows={rows} />
          <FactRow cell={deliveredCell} label="Runs delivered" rows={rows} />

          <GroupRow label="Cases with a confirmed major problem" />
          {manifest.criteria.map((criterion) => (
            <FactRow
              cell={(row) => qualityCell(row, criterion.id)}
              key={criterion.id}
              label={criterion.label}
              rows={rows}
            />
          ))}

          <GroupRow label="Delivery" />
          <FactRow cell={costCell} label="Cost per 1,000" rows={rows} />
          <FactRow cell={waitCell} label="Wait, typical / slowest (p50 / p95)" rows={rows} />
        </TableBody>
      </Table>

      <p className="text-muted-foreground text-xs">
        {plural(first ? first.ties : 0, "case")} tied · {first?.unresolved ?? 0} unresolved ·{" "}
        {counts.map(([language, count]) => `${count} ${languageName(language)}`).join(", ")} ·
        measured {formatDate(manifest.date)}
      </p>
    </div>
  );
}
