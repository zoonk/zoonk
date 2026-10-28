"use client";

import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type SyntheticEvent, useState } from "react";
import { type StatsAnalysisPath } from "../_utils/stats-analysis-groups";
import { type AdminStatsPeriod, type StatsPeriod } from "../_utils/stats-period";

const PERIODS = [
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
  { label: "All time", value: "all" },
] as const satisfies { label: string; value: AdminStatsPeriod }[];

const CUSTOM_RANGE_ERROR_ID = "stats-custom-range-error";

function getPresetSearchParams({
  currentQuery,
  period,
}: {
  currentQuery: string;
  period: AdminStatsPeriod;
}): URLSearchParams {
  const searchParams = new URLSearchParams(currentQuery);
  searchParams.set("period", period);
  searchParams.delete("offset");
  searchParams.delete("start");
  searchParams.delete("end");
  return searchParams;
}

export function StatsPeriodPicker({
  currentQuery,
  path,
  statsPeriod,
}: {
  currentQuery: string;
  path: StatsAnalysisPath;
  statsPeriod: StatsPeriod;
}) {
  const router = useRouter();
  const [customRangeError, setCustomRangeError] = useState<string>();
  const startValue = statsPeriod.current.start.toISOString().slice(0, 10);
  const endValue = statsPeriod.chartEnd.toISOString().slice(0, 10);
  const latestCustomDate = useMountTime().toISOString().slice(0, 10);
  const canPage = statsPeriod.period === "month" || statsPeriod.period === "year";

  function selectPreset(period: AdminStatsPeriod) {
    setCustomRangeError(undefined);
    router.push(`${path}?${getPresetSearchParams({ currentQuery, period }).toString()}`);
  }

  function movePeriod(offset: number) {
    setCustomRangeError(undefined);
    const searchParams = new URLSearchParams(currentQuery);
    searchParams.set("period", statsPeriod.period);
    searchParams.set("offset", offset.toString());
    router.push(`${path}?${searchParams.toString()}`);
  }

  function submitCustomPeriod(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedStart = getFormFieldValue(formData.get("start"));
    const submittedEnd = getFormFieldValue(formData.get("end"));

    if (!submittedStart || !submittedEnd) {
      return;
    }

    if (submittedStart > submittedEnd) {
      setCustomRangeError("To date must be on or after From date.");
      return;
    }

    setCustomRangeError(undefined);

    const searchParams = new URLSearchParams(currentQuery);
    searchParams.set("period", "custom");
    searchParams.set("start", submittedStart);
    searchParams.set("end", submittedEnd);
    searchParams.delete("offset");
    router.push(`${path}?${searchParams.toString()}`);
  }

  return (
    <Popover key={`${statsPeriod.period}-${statsPeriod.offset}-${statsPeriod.periodLabel}`}>
      <PopoverTrigger
        render={
          <Button
            aria-label={`Choose period. Current: ${statsPeriod.periodLabel}`}
            className="max-w-full justify-between sm:max-w-64"
            variant="ghost"
          />
        }
      >
        <CalendarIcon aria-hidden />
        <span className="truncate">{statsPeriod.periodLabel}</span>
        <ChevronDownIcon aria-hidden />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] gap-5">
        <PopoverHeader>
          <PopoverTitle>Period</PopoverTitle>
        </PopoverHeader>

        <div aria-label="Period presets" className="grid grid-cols-3 gap-1" role="group">
          {PERIODS.map((period) => (
            <Button
              key={period.value}
              onClick={() => selectPreset(period.value)}
              size="sm"
              variant={statsPeriod.period === period.value ? "default" : "ghost"}
            >
              {period.label}
            </Button>
          ))}
        </div>

        {canPage ? (
          <div className="border-border/60 flex items-center justify-between border-y py-3">
            <Button
              aria-label="Previous period"
              onClick={() => movePeriod(statsPeriod.offset + 1)}
              size="icon-sm"
              variant="ghost"
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <span className="text-sm font-medium">{statsPeriod.periodLabel}</span>
            <Button
              aria-label="Next period"
              disabled={statsPeriod.offset === 0}
              onClick={() => movePeriod(statsPeriod.offset - 1)}
              size="icon-sm"
              variant="ghost"
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        ) : null}

        <form className="flex flex-col gap-3" onSubmit={submitCustomPeriod}>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="stats-start-date">From</Label>
              <Input
                aria-describedby={customRangeError ? CUSTOM_RANGE_ERROR_ID : undefined}
                aria-invalid={Boolean(customRangeError)}
                defaultValue={startValue}
                id="stats-start-date"
                max={latestCustomDate}
                name="start"
                onChange={() => setCustomRangeError(undefined)}
                required
                type="date"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="stats-end-date">To</Label>
              <Input
                aria-describedby={customRangeError ? CUSTOM_RANGE_ERROR_ID : undefined}
                aria-invalid={Boolean(customRangeError)}
                defaultValue={endValue}
                id="stats-end-date"
                max={latestCustomDate}
                name="end"
                onChange={() => setCustomRangeError(undefined)}
                required
                type="date"
              />
            </div>
          </div>
          {customRangeError ? (
            <p className="text-destructive-text text-sm" id={CUSTOM_RANGE_ERROR_ID} role="alert">
              {customRangeError}
            </p>
          ) : null}
          <Button type="submit" variant="outline">
            Apply custom range
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** FormData also permits File values, so only strings become a date query. */
function getFormFieldValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}
