"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { EnterButton } from "@zoonk/ui/components/enter-button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
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
  const [open, setOpen] = useState(false);
  const [customRangeError, setCustomRangeError] = useState<string>();
  const startValue = statsPeriod.current.start.toISOString().slice(0, 10);
  const endValue = statsPeriod.chartEnd.toISOString().slice(0, 10);
  const latestCustomDate = useMountTime().toISOString().slice(0, 10);
  const canPage = statsPeriod.period === "month" || statsPeriod.period === "year";

  function selectPreset(period: AdminStatsPeriod) {
    setCustomRangeError(undefined);
    setOpen(false);
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
    setOpen(false);

    const searchParams = new URLSearchParams(currentQuery);
    searchParams.set("period", "custom");
    searchParams.set("start", submittedStart);
    searchParams.set("end", submittedEnd);
    searchParams.delete("offset");
    router.push(`${path}?${searchParams.toString()}`);
  }

  return (
    <Drawer
      key={`${statsPeriod.period}-${statsPeriod.offset}-${statsPeriod.periodLabel}`}
      onOpenChange={(next) => {
        setOpen(next);
        setCustomRangeError(undefined);
      }}
      open={open}
    >
      <DrawerTrigger
        render={
          <Button
            aria-label={`Choose period. Current: ${statsPeriod.periodLabel}`}
            className="max-w-full justify-between sm:max-w-64"
            size="bar"
            variant="outline"
          />
        }
      >
        <CalendarIcon aria-hidden className="max-sm:hidden" />
        <span className="truncate">{statsPeriod.periodLabel}</span>
        <ChevronDownIcon aria-hidden />
      </DrawerTrigger>

      <DrawerPopup className="sm:max-w-sm">
        <DrawerHeader closeLabel="Close">
          <DrawerTitle>Period</DrawerTitle>
        </DrawerHeader>

        <form className="contents" onSubmit={submitCustomPeriod}>
          <DrawerContent className="flex flex-col gap-5 pt-2">
            <PeriodPresets current={statsPeriod.period} onSelect={selectPreset} />

            {canPage ? (
              <PeriodStepper
                label={statsPeriod.periodLabel}
                offset={statsPeriod.offset}
                onMove={movePeriod}
              />
            ) : null}

            <CustomRangeFields
              end={endValue}
              error={customRangeError}
              latest={latestCustomDate}
              onEdit={() => setCustomRangeError(undefined)}
              start={startValue}
            />
          </DrawerContent>

          <DrawerFooter>
            <DrawerClose render={<Button size="lg" type="button" variant="outline" />}>
              Cancel
            </DrawerClose>
            <EnterButton type="submit">Apply dates</EnterButton>
          </DrawerFooter>
        </form>
      </DrawerPopup>
    </Drawer>
  );
}

function PeriodPresets({
  current,
  onSelect,
}: {
  current: AdminStatsPeriod;
  onSelect: (period: AdminStatsPeriod) => void;
}) {
  return (
    <div aria-label="Period presets" className="grid grid-cols-3 gap-1" role="group">
      {PERIODS.map((period) => (
        <Button
          key={period.value}
          onClick={() => onSelect(period.value)}
          type="button"
          variant={current === period.value ? "default" : "ghost"}
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
}

/** Older periods first: the offset counts back from the current one. */
function PeriodStepper({
  label,
  offset,
  onMove,
}: {
  label: string;
  offset: number;
  onMove: (offset: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-y py-1">
      <Button
        aria-label="Previous period"
        onClick={() => onMove(offset + 1)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ChevronLeftIcon aria-hidden />
      </Button>
      <span className="text-sm font-medium">{label}</span>
      <Button
        aria-label="Next period"
        disabled={offset === 0}
        onClick={() => onMove(offset - 1)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ChevronRightIcon aria-hidden />
      </Button>
    </div>
  );
}

function CustomRangeFields({
  end,
  error,
  latest,
  onEdit,
  start,
}: {
  end: string;
  error?: string;
  latest: string;
  onEdit: () => void;
  start: string;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <DateField
          defaultValue={start}
          error={error}
          id="stats-start-date"
          label="From"
          latest={latest}
          name="start"
          onEdit={onEdit}
        />
        <DateField
          defaultValue={end}
          error={error}
          id="stats-end-date"
          label="To"
          latest={latest}
          name="end"
          onEdit={onEdit}
        />
      </div>

      {/* A line that is always there, so the error moves nothing when it appears. */}
      <p className="text-destructive-text min-h-5 text-sm" id={CUSTOM_RANGE_ERROR_ID} role="alert">
        {error}
      </p>
    </>
  );
}

function DateField({
  defaultValue,
  error,
  id,
  label,
  latest,
  name,
  onEdit,
}: {
  defaultValue: string;
  error?: string;
  id: string;
  label: string;
  latest: string;
  name: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        aria-describedby={error ? CUSTOM_RANGE_ERROR_ID : undefined}
        aria-invalid={Boolean(error)}
        defaultValue={defaultValue}
        id={id}
        max={latest}
        name={name}
        onChange={onEdit}
        required
        type="date"
      />
    </div>
  );
}

/** FormData also permits File values, so only strings become a date query. */
function getFormFieldValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}
