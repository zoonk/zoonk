import { MIN_PATTERN_ANSWERS, type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import {
  ChartInspector,
  ChartInspectorPoint,
  ChartInspectorPoints,
  ChartInspectorTooltip,
} from "@zoonk/ui/components/chart-inspector";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { CrownIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";

const PERCENT = 100;

const COLUMN_CLASS = "flex min-w-0 flex-col items-center gap-1.5 px-0.5 pt-1 pb-2";

const VALUE_ROW_CLASS = "flex h-9 flex-col items-center justify-end gap-0.5";

const BAR_CLASS = "h-28 w-full max-w-8 rounded-[3px] sm:h-36";

const ICON_CLASS = "mt-0.5 flex size-4.5";

const NAME_CLASS = "max-w-full truncate text-xs leading-4";

const CAPTION_CLASS = "-mt-1 text-[0.6875rem] leading-4";

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

/** A group with too few answers to count is gray, so a lucky answer never reads as a result. */
const PATTERN_STATE = {
  best: {
    bar: "bg-success",
    icon: "text-success",
    name: "text-foreground font-medium",
    value: "text-foreground font-semibold",
  },
  counted: {
    bar: "bg-success/45",
    icon: "text-muted-foreground",
    name: "text-muted-foreground",
    value: "text-foreground",
  },
  few: {
    bar: "bg-foreground/20",
    icon: "text-muted-foreground",
    name: "text-muted-foreground",
    value: "text-muted-foreground",
  },
  none: {
    bar: "",
    icon: "text-muted-foreground",
    name: "text-muted-foreground",
    value: "text-muted-foreground",
  },
} as const satisfies Record<PatternState, Record<"bar" | "icon" | "name" | "value", string>>;

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

/** Keeps a malformed stored share inside the bar while the number still says what was stored. */
function getBarHeight(score: number): string {
  return `${Math.min(PERCENT, Math.max(0, score))}%`;
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

  return (
    <ChartInspectorPoint
      className={cn("data-active:bg-muted rounded-lg", COLUMN_CLASS)}
      index={index}
      render={<li />}
    >
      <span className={VALUE_ROW_CLASS}>
        {state === "best" && (
          <>
            <CrownIcon aria-hidden="true" className="text-success size-3.5" />
            <span className="sr-only">{bestLabel}</span>
          </>
        )}
        <span className={cn("font-mono text-xs leading-4 tabular-nums", tone.value)}>
          {state === "none" ? DASH : value}
        </span>
      </span>

      <span
        aria-hidden="true"
        className={cn("bg-surface-3 flex items-end overflow-hidden", BAR_CLASS)}
      >
        {state !== "none" && (
          <span
            className={cn("w-full rounded-[3px]", tone.bar)}
            style={{ height: getBarHeight(column.pattern.score) }}
          />
        )}
      </span>

      {column.icon && (
        <span aria-hidden="true" className={cn("[&>svg]:size-full", ICON_CLASS, tone.icon)}>
          {column.icon}
        </span>
      )}

      <span className={cn(NAME_CLASS, tone.name)}>
        {column.shortName ? (
          <>
            <span aria-hidden="true" className="block first-letter:uppercase">
              {column.shortName}
            </span>
            <span className="sr-only">{column.name}</span>
          </>
        ) : (
          <span className="block first-letter:uppercase">{column.name}</span>
        )}
      </span>

      {column.caption && (
        <span className={cn("text-faint font-mono whitespace-nowrap tabular-nums", CAPTION_CLASS)}>
          {column.caption}
        </span>
      )}

      <span className="sr-only">{state === "none" ? value : note}</span>
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

  const details = points.map(({ column, note, value }) => ({ label: column.name, note, value }));
  const bestIndex = columns.findIndex((column) => getPatternState(column) === "best");

  return (
    <PageSection aria-labelledby={id}>
      <PageSectionHeader>
        <PageSectionTitle id={id}>{title}</PageSectionTitle>
      </PageSectionHeader>

      <ChartInspector defaultIndex={Math.max(0, bestIndex)} details={details}>
        <ChartInspectorPoints aria-labelledby={id}>
          <ul className="grid" style={getColumnsStyle(columns.length)}>
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

        <ChartInspectorTooltip />
      </ChartInspector>
    </PageSection>
  );
}

function PatternColumnSkeleton({ icons }: { icons: boolean }) {
  return (
    <div className={COLUMN_CLASS}>
      <span className={VALUE_ROW_CLASS} />
      <Skeleton className={BAR_CLASS} />
      {icons && <Skeleton className={ICON_CLASS} />}
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

      <div className="grid" style={getColumnsStyle(columns)}>
        {Array.from({ length: columns }, (_, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- Static placeholders.
          <PatternColumnSkeleton icons={icons} key={index} />
        ))}
      </div>
    </div>
  );
}
