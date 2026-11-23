import { AdminJson } from "@/components/admin-json";
import { screenKindLabel } from "@/components/screen-words";
import { formatCount } from "@/lib/format";
import { FoldChevron } from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { ContentFixMap, readMapIdeas } from "./content-fix-map";
import {
  NUMBER_CLASS,
  ROW_CLASS,
  type ScreenContext,
  type ScreenMedia,
  ShownRow,
  screenHeadline,
} from "./content-fix-screen-row";
import { VocabularyChanges } from "./content-fix-vocabulary";
import {
  type ScreenRow,
  type SnapshotScreen,
  type StoredScreens,
  isMarkedOnly,
  readScreenRows,
} from "./screen-list";

type Context = ScreenContext;

/** "Explanation ×2, Fill blank": each kind once, in the order the screens show them. */
function kindsInWords(screens: readonly SnapshotScreen[]): string {
  const counts = new Map<string, number>();

  for (const screen of screens) {
    const kind = screenKindLabel(screen);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }

  return [...counts]
    .map(([kind, count]) => (count > 1 ? `${kind} ×${String(count)}` : kind))
    .join(", ");
}

type Run = { rows: ScreenRow[]; status: ScreenRow["status"] };

/** Neighbors with the same news read as one: unchanged screens fold, new and removed ones share a tint. */
function toRuns(rows: readonly ScreenRow[]): Run[] {
  const grouped = new Set<ScreenRow["status"]>(["new", "removed", "unchanged"]);

  const runs: Run[] = [];

  for (const row of rows) {
    const last = runs.at(-1);

    if (last && last.status === row.status && grouped.has(row.status)) {
      last.rows.push(row);
    } else {
      runs.push({ rows: [row], status: row.status });
    }
  }

  return runs;
}

function UnchangedRun({ context, rows }: { context: Context; rows: ScreenRow[] }) {
  const screens = rows.map((row) => row.screen);
  const positions = rows.map((row) => ("position" in row ? row.position : 0));
  const first = positions[0] ?? 0;
  const last = positions.at(-1) ?? first;

  return (
    <li>
      <details className="group/disclosure text-xs">
        <summary
          className={cn(
            ROW_CLASS,
            "text-muted-foreground hover:text-foreground min-h-11 cursor-pointer list-none items-start py-3 select-none [&::-webkit-details-marker]:hidden",
          )}
        >
          <span className={NUMBER_CLASS}>
            {first === last ? first : `${String(first)}–${String(last)}`}
          </span>
          <span className="leading-5">
            <span className="text-foreground">
              {formatCount(screens.length, "screen")} unchanged
            </span>
            {FACT_SEPARATOR}
            {kindsInWords(screens)}
            <FoldChevron className="ms-1 inline-block size-3.5 align-[-0.2em]" inline />
          </span>
        </summary>
        <ol className="flex flex-col pb-2 text-sm leading-6">
          {rows.map((row, index) => (
            <li className="flex gap-2" key={row.screen.id}>
              <span className={cn(NUMBER_CLASS, "w-9 shrink-0")}>{positions[index]}</span>
              <span className="text-muted-foreground text-xs leading-6 font-medium">
                {screenKindLabel(row.screen)}
              </span>
              <span className="min-w-0 truncate" lang={context.lang}>
                {screenHeadline({
                  ideas: context.ideas.length,
                  screen: row.screen,
                  snapshot: context.change.after,
                })}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}

const TINTS: Partial<Record<ScreenRow["status"], string>> = {
  new: "bg-success/5",
  removed: "bg-destructive/5",
};

function ScreenRuns({ context, rows }: { context: Context; rows: readonly ScreenRow[] }) {
  return toRuns(rows).map((run) => {
    const key = `${run.status}:${run.rows[0]?.screen.id ?? ""}`;

    if (run.status === "unchanged") {
      return <UnchangedRun context={context} key={key} rows={run.rows} />;
    }

    const shown = run.rows.flatMap((row) =>
      row.status === "unchanged"
        ? []
        : [<ShownRow context={context} key={row.screen.id} row={row} />],
    );

    const tint = TINTS[run.status];

    return tint ? (
      <li className={cn(tint, "-mx-2.5 rounded-xl px-2.5")} key={key}>
        <ol className="divide-y">{shown}</ol>
      </li>
    ) : (
      shown
    );
  });
}

function countsInWords(rows: readonly ScreenRow[], total: number): string {
  const groups = [
    { label: "new", matches: (row: ScreenRow) => row.status === "new" },
    { label: "removed", matches: (row: ScreenRow) => row.status === "removed" },
    { label: "moved", matches: (row: ScreenRow) => row.status === "moved" },
    {
      label: "changed",
      matches: (row: ScreenRow) => row.status === "changed" && !isMarkedOnly(row),
    },
    { label: "marked again", matches: isMarkedOnly },
    { label: "unchanged", matches: (row: ScreenRow) => row.status === "unchanged" },
  ];

  return [
    ...groups.map(({ label, matches }) => {
      const count = rows.filter((row) => matches(row)).length;
      return count > 0 ? `${String(count)} ${label}` : null;
    }),
    `${String(total)} in all`,
  ]
    .filter(Boolean)
    .join(FACT_SEPARATOR);
}

/**
 * A lesson's new screen list, in its final order: what's new or removed in full, as learners see
 * it, a changed screen before and after, and the screens left as they were folded.
 */
export function ScreenListChange({
  change,
  lang,
  media,
}: {
  change: StoredScreens;
  lang?: string;
  media: ScreenMedia;
}) {
  const rows = readScreenRows(change);
  const context: Context = { change, ideas: readMapIdeas(change), lang, media };

  return (
    <>
      <li className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Screens</h3>
        <p className="text-muted-foreground text-xs">
          {countsInWords(rows, change.after.screens.length)}
        </p>
        <ol className="flex flex-col">
          <ScreenRuns context={context} rows={rows} />
        </ol>
      </li>

      <VocabularyChanges change={change} lang={lang} media={media} />
      <ContentFixMap change={change} context={context} rows={rows} />

      <li>
        <AdminJson
          label="Whole screens before and after"
          value={{ after: change.after, before: change.before }}
        />
      </li>
    </>
  );
}
