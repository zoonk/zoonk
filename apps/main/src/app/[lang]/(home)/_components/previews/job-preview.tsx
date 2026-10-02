import { PREVIEW_CARD_CLASS } from "@/components/public/landing-styles";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";

/** SQL is shown as written in every language, like in a real job. */
const QUERY_LINES = [
  { after: "(sales)", fn: "SUM", keyword: "SELECT", rest: " region, " },
  { after: "", fn: "", keyword: "FROM", rest: " orders" },
  { after: "", fn: "", keyword: "GROUP BY", rest: " region;" },
] as const;

const SALES = { north: 42_180, south: 37_920, west: 29_400 } as const;

/** A problem from real work: a SQL query that runs, with its result. */
export async function JobPreview() {
  const [t, format] = await Promise.all([getExtracted(), getFormatter()]);

  const rows = [
    { amount: SALES.north, isTop: true, region: t("North") },
    { amount: SALES.south, isTop: false, region: t("South") },
    { amount: SALES.west, isTop: false, region: t("West") },
  ];

  return (
    <div aria-hidden="true" className={cn(PREVIEW_CARD_CLASS, "mt-5 flex-1 p-4 sm:mt-6")}>
      <p className="text-sm font-medium">{t("Which region sold the most?")}</p>

      <pre className="mt-3 overflow-hidden rounded-xl bg-neutral-950 px-3.5 py-3 font-mono text-[12.5px] leading-[1.65] text-neutral-100 dark:bg-black">
        {QUERY_LINES.map((line) => (
          <code className="block" key={line.keyword}>
            <span className="text-sky-300">{line.keyword}</span>
            {line.rest}
            {line.fn && <span className="text-amber-200">{line.fn}</span>}
            {line.after}
          </code>
        ))}
      </pre>

      <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-snug font-medium text-emerald-700 dark:text-emerald-400">
        <LineMarker>
          <CircleCheckIcon className="size-4" />
        </LineMarker>
        {t("It works. 3 rows")}
      </p>

      <div className="bg-muted/60 divide-border mt-3 divide-y rounded-xl px-3 text-[13px] tabular-nums dark:bg-neutral-800">
        {rows.map((row) => (
          <p
            className={cn(
              "flex justify-between gap-3 py-1.5",
              row.isTop ? "font-semibold" : "text-muted-foreground",
            )}
            key={row.region}
          >
            <span>{row.region}</span>
            <span>{format.number(row.amount)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
