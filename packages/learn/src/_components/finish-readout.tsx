"use client";

import { type FinishPrecision, type FinishReason } from "@zoonk/core/plans/finish-contract";
import { BigQuantity } from "@zoonk/ui/components/big-quantity";
import { cn } from "@zoonk/ui/lib/utils";
import { getIsoDateParts } from "@zoonk/utils/date-format";
import { useExtracted } from "next-intl";
import { useFormatIsoDate, useIsoToday } from "../_utils/iso-date";
import { useAppLocale } from "../_utils/locale";

/** When an undated plan finishes, as core forecasts it for the schedule shown. */
export type FinishForecast = {
  endDate: string | null;
  finishReason?: FinishReason | null;
  precision?: FinishPrecision | null;
};

/** A figure over the words that say what it counts. */
export function Readout({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-readout text-2xl leading-tight">{children}</span>
      <span className="text-muted-foreground text-xs leading-snug">{label}</span>
    </div>
  );
}

/** The month reads first and big, its year small, in the locale's order. */
function MonthYear({ isoDate }: { isoDate: string }) {
  const locale = useAppLocale();
  const today = useIsoToday();
  const parts = getIsoDateParts({ isoDate, locale, role: "rowMonth", today, year: "always" });

  return parts.map((part, index) =>
    part.type === "year" ? (
      // oxlint-disable-next-line react/no-array-index-key -- the parts are fixed for this date
      <span className="text-muted-foreground text-compact font-medium" key={index}>
        {part.value}
      </span>
    ) : (
      part.value
    ),
  );
}

function FinishFigure({ endDate, precision }: { endDate: string; precision: FinishPrecision }) {
  const formatDate = useFormatIsoDate();

  return precision === "year" ? formatDate(endDate, "year") : <MonthYear isoDate={endDate} />;
}

/** A language plan ends where its aim is, so it reads as the aim and when it's reached. */
function useAimLabel() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return ({ endDate, precision }: { endDate: string; precision: FinishPrecision }) =>
    t({
      description:
        'Under the level a language plan reaches: when. {month} is a month and year, like "Nov 2027", or a year alone, like "2031", when the finish is far.',
      message: "by {month}",
      values: {
        month:
          precision === "year"
            ? formatDate(endDate, "year")
            : formatDate(endDate, "sentenceMonth", { year: "always" }),
      },
    });
}

/**
 * When an undated plan finishes: its month near, its year far, and "10+ years" past the years a
 * plan lays out, a language aim's too. No "~": the label already says it's an estimate. Nothing while there's no date to
 * show.
 */
export function FinishReadout({
  aim = null,
  className,
  forecast,
}: {
  aim?: string | null;
  className?: string;
  forecast: FinishForecast;
}) {
  const t = useExtracted();
  const aimLabel = useAimLabel();
  const { endDate } = forecast;
  const precision = forecast.precision ?? "month";
  const beyond = !endDate && forecast.finishReason === "beyondHorizon";

  if (!endDate && !beyond) {
    return null;
  }

  if (!endDate) {
    return (
      <Readout
        className={className}
        label={t({
          description: "Under '10+ years': how long finishing the plan takes at the time picked.",
          message: "to finish",
        })}
      >
        <BigQuantity>
          {t({
            description:
              "How long finishing the plan takes at the time picked, when it's more than ten years.",
            message: "10+ years",
          })}
        </BigQuantity>
      </Readout>
    );
  }

  if (aim) {
    return (
      <Readout className={className} label={aimLabel({ endDate, precision })}>
        {aim}
      </Readout>
    );
  }

  return (
    <Readout className={className} label={t("estimated finish")}>
      <FinishFigure endDate={endDate} precision={precision} />
    </Readout>
  );
}

/**
 * Beside the time picked: when that time finishes the plan, said again as the time or the days
 * change. While it's worked out again, the last one stays, dimmed.
 */
export function PickedTimeFinish({
  aim = null,
  forecast,
  updating = false,
}: {
  aim?: string | null;
  forecast: FinishForecast | null;
  updating?: boolean;
}) {
  return (
    <div
      aria-busy={updating || undefined}
      aria-live="polite"
      className={cn("min-w-0 transition-opacity", updating && "opacity-50")}
    >
      {forecast && <FinishReadout aim={aim} className="items-end text-end" forecast={forecast} />}
    </div>
  );
}
