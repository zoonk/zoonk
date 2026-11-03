import { DayList, type DayListStep, DaySegments } from "@/components/public/day-list";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { ProductWindow } from "@/components/public/product-window";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

/** Rows a little larger than the app's, so a phone reads them at a glance. */
export const EXAMPLE_ROWS_CLASS =
  "**:data-[slot=list-row-description]:text-[0.8125rem] **:data-[slot=list-row-title]:text-[0.9375rem] **:data-[slot=list-row-trailing]:text-[0.8125rem]";

export function ExampleCard({ className, ...props }: React.ComponentProps<"div">) {
  return <ProductWindow className={cn("p-5 sm:p-6", className)} {...props} />;
}

export async function ExampleCardHead({
  aside,
  detail,
  title,
}: {
  aside?: ReactNode;
  detail?: ReactNode;
  title: string;
}) {
  const t = await getExtracted();

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[1.0625rem] leading-snug font-semibold tracking-[-0.015em] text-pretty">
          {title}
        </p>
        <p className="text-muted-foreground text-[0.8125rem]">
          {t("Example")}
          {detail && (
            <>
              {` · `}
              {detail}
            </>
          )}
        </p>
      </div>
      {aside}
    </div>
  );
}

export async function getExampleDailyTime(minutes: number): Promise<string> {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();

  return t({
    description:
      "How long an example plan studies each day; {time} is a duration such as “30 min”.",
    message: "{time} a day",
    values: { time: minutesText(minutes) },
  });
}

export async function ExampleDay({ detail, steps }: { detail?: string; steps: DayListStep[] }) {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();
  const minutes = steps.reduce((sum, step) => sum + step.minutes, 0);

  return (
    <div className="flex flex-col">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[1.1875rem] leading-6 font-semibold tracking-[-0.02em]">
          {t("Today")}
        </span>
        <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-[0.8125rem]")}>
          {minutesText(minutes)}
        </span>
      </p>

      {detail && (
        <p className="text-muted-foreground mt-0.5 text-[0.8125rem]">{`${t("Example")} · ${detail}`}</p>
      )}

      <DaySegments className="mt-3 mb-1" steps={steps} />
      <DayList className={EXAMPLE_ROWS_CLASS} minutesText={minutesText} steps={steps} />
    </div>
  );
}
