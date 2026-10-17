import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { Pair } from "@/components/public/pair";
import { ProductWindow } from "@/components/public/product-window";
import { KindIcon } from "@zoonk/learn/kind-tile";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { SQL_NAMES, getExampleSet } from "./landing-examples";
import { CARD_CLASS, CARD_LABEL_CLASS } from "./practice-card-styles";

/** The skill the notebook's entry is filed under, as SQL writes it. */
const MISTAKE_SKILL = "GROUP BY";

/**
 * The new job: a real problem, a query that runs and the rows it gives, beside the Mistakes
 * notebook's entry for one that didn't.
 */
export async function JobPractice() {
  const t = await getExtracted();
  const format = await getFormatter();
  const set = await getExampleSet();
  const names = SQL_NAMES[set.market];

  const rows =
    set.market === "brazil"
      ? [
          { amount: 42_180, id: "southeast", region: t("Southeast") },
          { amount: 37_920, id: "northeast", region: t("Northeast") },
          { amount: 29_400, id: "south", region: t("South") },
        ]
      : [
          { amount: 42_180, id: "north", region: t("North") },
          { amount: 37_920, id: "south", region: t("South") },
          { amount: 29_400, id: "west", region: t("West") },
        ];

  const query = [
    {
      after: `(${names.sales}) AS total`,
      fn: "SUM",
      keyword: "SELECT",
      rest: ` ${names.region}, `,
    },
    { keyword: "FROM", rest: ` ${names.orders}` },
    { keyword: "GROUP BY", rest: ` ${names.region}` },
    { keyword: "ORDER BY", rest: " total DESC;" },
  ];

  return (
    <Pair aria-label={t("A real problem and the Mistakes notebook")}>
      <ProductWindow className={cn(CARD_CLASS, "gap-3")}>
        <p className={CARD_LABEL_CLASS}>{t("Real problem · SQL")}</p>
        <p className="text-base leading-snug font-[560] tracking-[-0.01em]">
          {t("Which region sold the most?")}
        </p>

        <pre className="text-muted-foreground border-input overflow-x-auto border-l-2 pl-3 font-mono text-[0.78125rem] leading-[1.7]">
          {query.map((line) => (
            <code className="block" key={line.keyword}>
              <span className="text-foreground font-medium">{line.keyword}</span>
              {line.rest}
              {line.fn && <span className="text-foreground font-medium">{line.fn}</span>}
              {line.after}
            </code>
          ))}
        </pre>

        <p className="text-success-text flex items-center gap-1.5 text-[0.84375rem] font-medium">
          <CircleCheckIcon aria-hidden="true" className="size-4" />
          {set.market === "brazil"
            ? t("It works. The Southeast sold the most.")
            : t("It works. North sold the most.")}
        </p>

        <ul className="divided-rows flex flex-col text-[0.84375rem]">
          {rows.map((row, index) => (
            <li
              className={cn(
                "flex justify-between gap-3 py-2",
                index > 0 && "text-muted-foreground",
              )}
              key={row.id}
            >
              <span className={cn(index === 0 && "font-medium")}>{row.region}</span>
              <span className={cn(NUMERIC_CLASS, "text-xs")}>{format.number(row.amount)}</span>
            </li>
          ))}
        </ul>
      </ProductWindow>

      <ProductWindow className={cn(CARD_CLASS, "gap-4")}>
        <p className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[0.84375rem] font-semibold">
            <KindIcon kind="mistakes" />
            {t("Mistakes notebook")}
          </span>
          <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-xs")}>
            {t("{count, number} to fix", { count: 2 })}
          </span>
        </p>

        <div className="flex flex-col gap-1.5">
          <p className="text-label">{MISTAKE_SKILL}</p>
          <p className="text-[0.9375rem] font-medium text-pretty">
            {t("Grouped by customer, not region")}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("SUM added each customer's sales, so the regions never showed.")}
          </p>
        </div>

        <p className="text-muted-foreground mt-auto pt-2 text-[0.84375rem]">
          {t("Practice this skill")}
        </p>
      </ProductWindow>
    </Pair>
  );
}
