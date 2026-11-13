import { MIN_PATTERN_ANSWERS, type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import {
  ChartInspector,
  ChartInspectorPoint,
  ChartInspectorPoints,
  ChartInspectorTooltip,
  type ChartPointDetail,
} from "@zoonk/ui/components/chart-inspector";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { CrownIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { PROGRESS_CONTENT_SELECTOR } from "../_components/progress-content";

const PERCENT = 100;

/** `--pattern-bar` is how tall a bar at 100% is. */
const CHART_CLASS = "grid [--pattern-bar:7rem] sm:[--pattern-bar:9rem]";

const COLUMN_CLASS = "flex min-w-0 flex-col items-center gap-2 pt-1 pb-2";

/** The 3rem above a full bar hold its value and the best column's crown. */
const PLOT_CLASS =
  "border-border flex h-[calc(var(--pattern-bar)+3rem)] w-full flex-col items-center justify-end gap-1 border-b";

const BAR_CLASS = "w-full max-w-8 shrink-0 rounded-t-meter";

const CHIP_CLASS = "flex size-9 items-center justify-center rounded-full";

const NAME_CLASS = "max-w-full truncate px-0.5 text-xs leading-4";

const CAPTION_CLASS = "-mt-1.5 text-2xs leading-4";

const DASH = "–";

export type PatternColumnView = {
  best: boolean;
  caption?: string;
  icon?: React.ReactNode;
  id: string;
  name: string;
  pattern: ScorePerformance;
  shortName?: string;
};

type PatternState = "best" | "counted" | "few" | "none";

/**
 * A group with too few answers to count is a hollow gray outline and one without answers has no bar,
 * so neither reads as a result.
 */
const PATTERN_STATE = {
  best: {
    bar: "bg-success",
    chip: "bg-success text-background",
    name: "text-foreground font-medium",
    value: "text-foreground font-semibold",
  },
  counted: {
    bar: "bg-success/45",
    chip: "bg-surface-3 text-foreground",
    name: "text-muted-foreground",
    value: "text-foreground",
  },
  few: {
    bar: "border-foreground/30 contrast-more:border-foreground border border-b-0 border-dashed",
    chip: "bg-surface-3 text-muted-foreground",
    name: "text-muted-foreground",
    value: "text-muted-foreground",
  },
  none: {
    bar: "",
    chip: "bg-surface-3 text-muted-foreground",
    name: "text-muted-foreground",
    value: "text-muted-foreground",
  },
} as const satisfies Record<PatternState, Record<"bar" | "chip" | "name" | "value", string>>;

function getPatternState({ best, pattern }: Pick<PatternColumnView, "best" | "pattern">) {
  if (pattern.totalAnswers === 0) {
    return "none";
  }

  if (pattern.totalAnswers < MIN_PATTERN_ANSWERS) {
    return "few";
  }

  return best ? "best" : "counted";
}

function getColumnsStyle(count: number): React.CSSProperties {
  return { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` };
}

/** Keeps a malformed stored share inside the plot while the number still says what was stored. */
function getBarHeight(score: number): string {
  return `calc(var(--pattern-bar) * ${Math.min(PERCENT, Math.max(0, score)) / PERCENT})`;
}

async function getPatternTexts(pattern: ScorePerformance) {
  const [t, format] = await Promise.all([getExtracted(), getFormatter()]);

  const answers = t("{count, plural, =0 {No answers} one {# answer} other {# answers}}", {
    count: pattern.totalAnswers,
  });

  // A group without answers says so instead of reading as 0%.
  if (pattern.totalAnswers === 0) {
    return { note: undefined, value: answers };
  }

  const value = format.number(pattern.score / PERCENT, {
    maximumFractionDigits: 0,
    style: "percent",
  });

  if (pattern.totalAnswers < MIN_PATTERN_ANSWERS) {
    return {
      note: t({
        description:
          "A chart tooltip's last line for a weekday or a time of day with fewer answers than it needs before its score counts as a pattern, such as “7 answers, needs 10 to count”.",
        message:
          "{count, plural, one {# answer} other {# answers}}, needs {minimum, number} to count",
        values: { count: pattern.totalAnswers, minimum: MIN_PATTERN_ANSWERS },
      }),
      value,
    };
  }

  return { note: answers, value };
}

function PatternColumn({
  bestLabel,
  column,
  index,
  note,
  value,
}: {
  bestLabel: string;
  column: PatternColumnView;
  index: number;
  note?: string;
  value: string;
}) {
  const state = getPatternState(column);
  const tone = PATTERN_STATE[state];

  const spoken = [state === "best" && bestLabel, column.name, column.caption, value, note]
    .filter(Boolean)
    .join(", ");

  return (
    <ChartInspectorPoint
      className={cn("data-active:bg-muted rounded-lg", COLUMN_CLASS)}
      index={index}
      render={<li />}
    >
      <span className="sr-only">{spoken}</span>

      <span aria-hidden="true" className={PLOT_CLASS}>
        {state === "best" && (
          <span className="bg-success text-background flex size-6 shrink-0 items-center justify-center rounded-full">
            <CrownIcon className="size-3.5" />
          </span>
        )}

        <span className={cn("font-mono text-xs leading-4 tabular-nums", tone.value)}>
          {state === "none" ? DASH : value}
        </span>

        {state !== "none" && (
          <span
            className={cn("min-h-0.5", BAR_CLASS, tone.bar)}
            style={{ height: getBarHeight(column.pattern.score) }}
          />
        )}
      </span>

      {column.icon && (
        <span aria-hidden="true" className={cn("[&>svg]:size-5", CHIP_CLASS, tone.chip)}>
          {column.icon}
        </span>
      )}

      <span aria-hidden="true" className={cn("first-letter:uppercase", NAME_CLASS, tone.name)}>
        {column.shortName ?? column.name}
      </span>

      {column.caption && (
        <span
          aria-hidden="true"
          className={cn("text-faint font-mono whitespace-nowrap tabular-nums", CAPTION_CLASS)}
        >
          {column.caption}
        </span>
      )}
    </ChartInspectorPoint>
  );
}

export async function PatternChart({
  bestLabel,
  columns,
  id,
  title,
}: {
  bestLabel: string;
  columns: PatternColumnView[];
  id: string;
  title: string;
}) {
  const points = await Promise.all(
    columns.map(async (column) => ({ column, ...(await getPatternTexts(column.pattern)) })),
  );

  const details = points.map(({ column, note, value }): ChartPointDetail => [
    column.name,
    value,
    note,
  ]);

  const bestIndex = columns.findIndex((column) => getPatternState(column) === "best");

  return (
    <PageSection aria-labelledby={id}>
      <PageSectionHeader>
        <PageSectionTitle id={id}>{title}</PageSectionTitle>
      </PageSectionHeader>

      <ChartInspector defaultIndex={Math.max(0, bestIndex)} details={details}>
        <ChartInspectorPoints aria-labelledby={id}>
          <ul className={CHART_CLASS} style={getColumnsStyle(columns.length)}>
            {points.map(({ column, note, value }, index) => (
              <PatternColumn
                bestLabel={bestLabel}
                column={column}
                index={index}
                key={column.id}
                note={note}
                value={value}
              />
            ))}
          </ul>
        </ChartInspectorPoints>

        <ChartInspectorTooltip within={PROGRESS_CONTENT_SELECTOR} />
      </ChartInspector>
    </PageSection>
  );
}

function PatternColumnSkeleton({ icons }: { icons: boolean }) {
  return (
    <div className={COLUMN_CLASS}>
      <span className={PLOT_CLASS}>
        <Skeleton className={cn("h-[calc(var(--pattern-bar)*0.7)] rounded-b-none", BAR_CLASS)} />
      </span>
      {icons && <Skeleton className={CHIP_CLASS} />}
      <Skeleton className={cn("h-4 w-7", icons && "w-12")} />
      {icons && <Skeleton className={cn("h-4 w-10", CAPTION_CLASS)} />}
    </div>
  );
}

export function PatternChartSkeleton({
  columns,
  icons = false,
  titleClassName,
}: {
  columns: number;
  icons?: boolean;
  titleClassName: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className={cn("my-1 h-4", titleClassName)} />

      <div className={CHART_CLASS} style={getColumnsStyle(columns)}>
        {Array.from({ length: columns }, (_, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- Static placeholders.
          <PatternColumnSkeleton icons={icons} key={index} />
        ))}
      </div>
    </div>
  );
}
