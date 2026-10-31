import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { getAppLocale } from "@/i18n/locale";
import { cn } from "@zoonk/ui/lib/utils";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { CheckIcon, FileSpreadsheetIcon, PlayIcon, SearchIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { type HeroExample } from "./hero-example";
import { toSheetWeekday } from "./sheet-weekday";

/** A Monday, so the spreadsheet's columns start on one. */
const MONDAY = new Date("2026-11-02T12:00:00Z");
const WEEKDAYS = 5;

/** Visibility moves with opacity, so a hidden piece leaves the accessibility tree once it has faded. */
const ARTIFACT_CLASS = cn(
  "bg-popover ring-border absolute z-2 overflow-hidden rounded-xl shadow-[0_1px_2px_oklch(0_0_0/6%),0_10px_24px_-10px_oklch(0_0_0/18%)] ring-1 dark:shadow-[0_1px_2px_oklch(0_0_0/50%),0_12px_28px_-12px_oklch(0_0_0/70%)]",
  "invisible scale-90 opacity-0 transition-[opacity,translate,rotate,scale,visibility] duration-200 ease-out motion-reduce:transition-[opacity,visibility]",
  "without-zoonk:visible without-zoonk:translate-0 without-zoonk:scale-100 without-zoonk:opacity-100",
);

function SearchArtifact({ example }: { example: HeroExample }) {
  return (
    <div
      className={cn(
        ARTIFACT_CLASS,
        "inset-x-0 top-1 translate-x-3 translate-y-[150px] sm:top-7 sm:left-auto sm:w-95",
        "without-zoonk:-rotate-[1.8deg]",
      )}
    >
      <p className="flex items-start gap-2.5 px-3.5 py-3 text-[0.9375rem] leading-5.5">
        <SearchIcon aria-hidden="true" className="text-muted-foreground mt-0.75 size-4 shrink-0" />
        <span className="min-w-0 text-pretty">
          {example.search}
          <span className="bg-foreground ml-0.5 inline-block h-4.5 w-px align-[-0.25rem]" />
        </span>
      </p>

      <ul className="border-t py-1">
        {example.suggestions.map((suggestion) => (
          <li
            className="text-muted-foreground flex items-center gap-2.5 px-3.5 py-1.5 text-[0.84375rem]"
            key={suggestion}
          >
            <SearchIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabsArtifact({ example }: { example: HeroExample }) {
  const [first, second] = example.tabs;

  return (
    <div
      className={cn(
        ARTIFACT_CLASS,
        "bg-muted top-[156px] left-0 flex w-full items-end gap-0.5 p-1.5 sm:top-[178px] sm:w-110",
        "without-zoonk:rotate-[1.4deg] without-zoonk:delay-50 translate-x-3 translate-y-[70px] sm:translate-x-6",
      )}
    >
      {[first, second].map((tab, index) => (
        <p
          className={cn(
            "flex h-9 min-w-0 items-center gap-1.5 rounded-lg px-2 text-xs",
            index === 0
              ? "bg-popover text-foreground shadow-[0_1px_2px_oklch(0_0_0/8%)]"
              : "text-muted-foreground",
          )}
          key={tab}
        >
          <span className="bg-surface-3 hidden size-3.75 shrink-0 place-items-center rounded-sm sm:grid">
            <PlayIcon aria-hidden="true" className="fill-muted-foreground size-1.75 stroke-none" />
          </span>
          <span className="truncate">{tab}</span>
        </p>
      ))}

      <span
        className={cn(
          NUMERIC_CLASS,
          "bg-surface-3 text-muted-foreground mr-0.5 ml-auto shrink-0 self-center rounded-md px-1.5 py-0.5 text-xs",
        )}
      >
        {`+${example.moreTabs}`}
      </span>
    </div>
  );
}

/** How many days of each week were ticked before the schedule was dropped. */
const SHEET_WEEKS = [WEEKDAYS, 2, 0];

const SHEET_CELL_CLASS = "grid h-6.75 place-items-center border-r border-b";

async function SheetArtifact({ example }: { example: HeroExample }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getAppLocale();

  const weekdays = Array.from({ length: WEEKDAYS }, (_, index) =>
    toSheetWeekday({
      locale,
      weekday: format.dateTime(new Date(MONDAY.getTime() + index * MS_PER_DAY), {
        timeZone: "UTC",
        weekday: "short",
      }),
    }),
  );

  const weeks = SHEET_WEEKS.map((done, index) => ({
    done,
    label: t({
      description: "A spreadsheet's row label, short for “Week”.",
      message: "Wk {number, number}",
      values: { number: index + 1 },
    }),
  }));

  return (
    <div
      className={cn(
        ARTIFACT_CLASS,
        "top-[228px] right-[3%] w-[92%] sm:top-[286px] sm:right-7 sm:w-82.5",
        "without-zoonk:-rotate-[2.2deg] without-zoonk:delay-100 -translate-x-2 -translate-y-1.5",
      )}
    >
      <p className="text-muted-foreground flex items-center gap-2 border-b px-3 py-2.25 text-xs">
        <FileSpreadsheetIcon aria-hidden="true" className="size-3.75 shrink-0" />
        <span className={cn(NUMERIC_CLASS, "truncate")}>{example.file}</span>
      </p>

      <div
        className={cn(
          NUMERIC_CLASS,
          "text-muted-foreground grid grid-cols-[3.625rem_repeat(5,minmax(0,1fr))] text-xs [&>*:nth-child(6n)]:border-r-0 [&>*:nth-last-child(-n+6)]:border-b-0",
        )}
      >
        <span className={cn(SHEET_CELL_CLASS, "bg-muted")} />
        {weekdays.map((weekday) => (
          <span className={cn(SHEET_CELL_CLASS, "bg-muted text-faint font-medium")} key={weekday}>
            {weekday}
          </span>
        ))}

        {weeks.flatMap((week) => [
          <span
            className={cn(SHEET_CELL_CLASS, "text-faint justify-items-start pl-2")}
            key={week.label}
          >
            {week.label}
          </span>,
          ...weekdays.map((weekday, day) => (
            <span className={SHEET_CELL_CLASS} key={`${week.label}-${weekday}`}>
              {day < week.done && <CheckIcon aria-hidden="true" className="size-3" />}
            </span>
          )),
        ])}
      </div>
    </div>
  );
}

export function HeroMess({ example }: { example: HeroExample }) {
  return (
    <>
      <SearchArtifact example={example} />
      <TabsArtifact example={example} />
      <SheetArtifact example={example} />
    </>
  );
}
