import { type Decision } from "@/lib/comparisons/decision";
import { caseRunKey } from "@/lib/comparisons/identity";
import { type Comparison, type Variant } from "@/lib/comparisons/schemas";
import { formatDollars, formatSeconds } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { Fragment } from "react";
import {
  SIDE_LABELS,
  STATUS_LABELS,
  familyLabel,
  formatDate,
  languageName,
  laterModels,
  preferenceLeanLabel,
  variantName,
} from "../_utils/labels";
import { plural } from "../_utils/words";

type Row = Decision["rows"][number];
type CaseRuns = Row["quality"][number]["affected"];

/** Non-breaking spaces keep each note whole, so a narrow column breaks only between notes. */
function caseNote({
  both,
  owner,
  run,
}: {
  both: boolean;
  owner: boolean;
  run?: number;
}): string | null {
  const notes = [run !== undefined && `run ${run}`, both && "both sides", owner && "you found it"]
    .filter((note) => typeof note === "string")
    .map((note) => note.replaceAll(" ", "\u00A0"));

  return notes.length > 0 ? ` (${notes.join(", ")})` : null;
}

function CaseLinks({
  affected,
  both,
  owner,
  showRun,
}: {
  affected: CaseRuns;
  both: CaseRuns;
  owner: CaseRuns;
  showRun: boolean;
}) {
  if (affected.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }

  const bothKeys = new Set(both.map((run) => caseRunKey(run)));
  const ownerKeys = new Set(owner.map((run) => caseRunKey(run)));

  return (
    <span className="flex flex-col gap-1">
      {affected.map(({ caseId, run }) => {
        const key = caseRunKey({ caseId, run });

        return (
          <a
            className="font-mono text-xs underline underline-offset-4"
            href={`#case-${encodeURIComponent(caseId)}`}
            key={key}
          >
            {caseId}
            <span className="text-muted-foreground">
              {caseNote({
                both: bothKeys.has(key),
                owner: ownerKeys.has(key),
                run: showRun ? run : undefined,
              })}
            </span>
          </a>
        );
      })}
    </span>
  );
}

function weightedLabel(label: string, manifest: Comparison["manifest"], criterion: string) {
  const weight = manifest.priorities.comparison?.weights?.[criterion] ?? 1;
  return weight > 1 ? `${label} (counts ×${weight})` : label;
}

function weightedTotalCell(row: Row) {
  return (
    <ul>
      {Object.entries(row.weightedMajorsByLanguage ?? {}).map(([language, count]) => (
        <li key={language}>
          {languageName(language)} · {count}
        </li>
      ))}
    </ul>
  );
}

function qualityCell({
  row,
  criterion,
  check,
  showRun,
}: {
  row: Row;
  criterion: string;
  check?: true;
  showRun: boolean;
}) {
  const metrics = row.quality.filter(
    (metric) => metric.criterion === criterion && metric.check === check,
  );

  return (
    <CaseLinks
      affected={metrics.flatMap((metric) => metric.affected)}
      both={metrics.flatMap((metric) => metric.both)}
      owner={metrics.flatMap((metric) => metric.ownerAffected ?? [])}
      showRun={showRun}
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

  return languages.map(([language, delivery]) => (
    <span className="text-muted-foreground block text-xs" key={language}>
      {languageName(language)} <span className="font-mono">{value(delivery)}</span>
    </span>
  ));
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

function LaterModels({ variant }: { variant: Variant }) {
  const later = laterModels(variant);

  if (later.length === 0) {
    return null;
  }

  return (
    <span className="text-muted-foreground block text-xs font-normal">
      {later.map(({ name, step }) => (
        <Fragment key={step}>
          {step > 1 && ", "}then <span className="font-mono">{name}</span>
        </Fragment>
      ))}
    </span>
  );
}

function preferredCell(row: Row) {
  return `${row.wins} won · ${row.losses} lost`;
}

function deliveredCell(row: Row) {
  return (
    <>
      {row.succeeded} of {row.attempted}
      {row.missingMatches > 0 && (
        <span className="text-muted-foreground block text-xs">
          {plural(row.missingMatches, "missing match", "missing matches")}
        </span>
      )}
    </>
  );
}

function costCell(row: Row) {
  return (
    <>
      <span className="font-mono">{formatDollars(row.costPer1000)}</span>
      <DeliveryByLanguage row={row} value={(delivery) => formatDollars(delivery.costPer1000)} />
    </>
  );
}

function waitCell(row: Row, percentile: "p50" | "p95") {
  return (
    <>
      <span className="font-mono">{formatSeconds(row[percentile])}</span>
      <DeliveryByLanguage row={row} value={(delivery) => formatSeconds(delivery[percentile])} />
    </>
  );
}

function GroupRow({ label }: { label: string }) {
  return (
    <TableRow className="border-b-0">
      <TableCell className="pt-5 pb-0 font-medium whitespace-normal" colSpan={3}>
        {label}
      </TableCell>
    </TableRow>
  );
}

type PreferenceRow = Decision["preferences"][number];

function PreferenceCounts({ counts }: { counts: PreferenceRow["total"] }) {
  return (
    <span className="inline-flex flex-wrap gap-x-1.5">
      <span>
        Current <span className="font-mono">{counts.incumbent}</span>
      </span>
      <span>
        · Challenger <span className="font-mono">{counts.challenger}</span>
      </span>
      <span>
        · Tie <span className="font-mono">{counts.tie}</span>
      </span>
    </span>
  );
}

function PreferenceSplit({ split }: { split: Pick<PreferenceRow, "families" | "lean" | "total"> }) {
  if (split.families.length === 0) {
    return <span className="text-muted-foreground">No reads yet</span>;
  }

  return (
    <>
      <PreferenceCounts counts={split.total} />
      {split.lean && <p className="mt-1 text-xs">{preferenceLeanLabel(split.lean)}</p>}
      <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs">
        {split.families.map((family) => (
          <li className="flex flex-wrap gap-x-2" key={family.family}>
            <span className="font-medium">{familyLabel(family.family)}</span>
            <PreferenceCounts counts={family} />
          </li>
        ))}
      </ul>
    </>
  );
}

function ReaderPreferenceRow({ row }: { row: PreferenceRow }) {
  return (
    <TableRow>
      <th
        className="text-muted-foreground py-2 pr-3 text-left align-top text-sm font-normal"
        scope="row"
      >
        {row.label}
      </th>
      <TableCell className="align-top whitespace-normal" colSpan={2}>
        <PreferenceSplit split={row} />
        {row.byLanguage.length > 1 && (
          <details className="mt-1.5">
            <summary className="text-muted-foreground cursor-pointer text-xs">By language</summary>
            {row.byLanguage.map((language) => (
              <div className="mt-2 border-s ps-3" key={language.language}>
                <p className="mb-1 text-xs font-medium">{languageName(language.language)}</p>
                <PreferenceSplit split={language} />
              </div>
            ))}
          </details>
        )}
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

  const failedChecks = new Set(
    rows.flatMap((row) =>
      row.quality.filter((metric) => metric.check).map((metric) => metric.criterion),
    ),
  );

  const showRun = manifest.runs > 1;

  return (
    <div className="flex flex-col gap-2">
      <Table scrollLabel="Decision table">
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
                  {variant && <LaterModels variant={variant} />}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          <FactRow cell={statusCell} label="Status" rows={rows} />
          <FactRow cell={preferredCell} label="Settled cases" rows={rows} />
          <FactRow cell={deliveredCell} label="Runs delivered" rows={rows} />

          {decision.preferences.length > 0 && (
            <>
              <GroupRow label="Readers preferred" />
              {decision.preferences.map((row) => (
                <ReaderPreferenceRow key={row.criterion ?? ""} row={row} />
              ))}
            </>
          )}

          <GroupRow label={`${showRun ? "Runs" : "Cases"} with a confirmed major problem`} />
          <FactRow cell={weightedTotalCell} label="Weighted total" rows={rows} />
          {manifest.criteria.map((criterion) => (
            <FactRow
              cell={(row) => qualityCell({ criterion: criterion.id, row, showRun })}
              key={criterion.id}
              label={weightedLabel(criterion.label, manifest, criterion.id)}
              rows={rows}
            />
          ))}
          {[...failedChecks].map((check) => (
            <FactRow
              cell={(row) => qualityCell({ check: true, criterion: check, row, showRun })}
              key={check}
              label={`Code check · ${weightedLabel(
                manifest.criteria.find((criterion) => criterion.id === check)?.label ?? check,
                manifest,
                check,
              )}`}
              rows={rows}
            />
          ))}

          <GroupRow label="Delivery" />
          <FactRow cell={costCell} label="Cost per 1,000" rows={rows} />
          <FactRow cell={(row) => waitCell(row, "p50")} label="Typical wait (p50)" rows={rows} />
          <FactRow cell={(row) => waitCell(row, "p95")} label="Slowest wait (p95)" rows={rows} />
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
