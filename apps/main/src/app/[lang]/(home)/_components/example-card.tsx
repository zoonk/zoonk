import { DayList, type DayListStep, DaySegments } from "@/components/public/day-list";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { ProductWindow } from "@/components/public/product-window";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

/** Rows a little larger than the app's, so a phone reads them at a glance. */
export const EXAMPLE_ROWS_CLASS =
  "**:data-[slot=list-row-description]:text-compact **:data-[slot=list-row-description]:leading-4.5 **:data-[slot=list-row-title]:text-reading **:data-[slot=list-row-title]:leading-5 **:data-[slot=list-row-trailing]:text-compact";

const EXAMPLE_TITLE_CLASS = "text-base leading-snug font-semibold tracking-[-0.015em]";

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
        <p className={cn(EXAMPLE_TITLE_CLASS, "text-pretty")}>{title}</p>
        <p className="text-muted-foreground text-compact">
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

async function ExampleDay({ steps }: { steps: DayListStep[] }) {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();
  const minutes = steps.reduce((sum, step) => sum + step.minutes, 0);

  return (
    <div className="flex flex-col">
      <p className="flex items-baseline justify-between gap-3">
        <span className={EXAMPLE_TITLE_CLASS}>{t("Today")}</span>
        <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-compact")}>
          {minutesText(minutes)}
        </span>
      </p>

      <DaySegments className="mt-3 mb-1" steps={steps} />
      <DayList className={EXAMPLE_ROWS_CLASS} minutesText={minutesText} steps={steps} />
    </div>
  );
}

export async function ExampleDayCard({
  className,
  steps,
  title,
}: {
  className?: string;
  steps: DayListStep[];
  title: string;
}) {
  const minutes = steps.reduce((sum, step) => sum + step.minutes, 0);

  return (
    <ProductWindow className={className}>
      <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        <ExampleCardHead detail={await getExampleDailyTime(minutes)} title={title} />
      </div>

      <div className="border-t px-5 pt-4 pb-1.5 sm:px-6">
        <ExampleDay steps={steps} />
      </div>
    </ProductWindow>
  );
}
