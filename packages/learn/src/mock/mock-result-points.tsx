"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepRow, StepRows } from "../_components/step-card";
import { useMockNumber, useMockPercent } from "./mock-labels";
import { ResultSection } from "./mock-result-section";
import { type MockPoints, type Tally, type TestRow, toTestRows } from "./mock-result-test-rows";

type Minimum = MockPoints["unjudged"][number]["minimum"];

const POINT_DECIMALS = 100;

function round(value: number): number {
  return Math.round(value * POINT_DECIMALS) / POINT_DECIMALS;
}

function toScorePercent({ asked, earned }: Tally): number {
  return asked > 0 ? (earned / asked) * 100 : 0;
}

export function hasTestRows(points: MockPoints | null | undefined): points is MockPoints {
  return Boolean(
    points && (points.parts.length > 0 || points.minimum || points.unjudged.length > 0),
  );
}

function useFormatMinimum() {
  const points = useMockNumber();
  const percent = useMockPercent();

  return (minimum: Minimum) =>
    minimum.unit === "percent" ? percent(minimum.value) : points(minimum.value);
}

function useRequirementLine() {
  const t = useExtracted();
  const formatMinimum = useFormatMinimum();
  const percent = useMockPercent();

  return (row: TestRow & { minimum: Minimum }): string => {
    const values = {
      minimum: formatMinimum(row.minimum),
      score: percent(toScorePercent(row)),
      short: round(row.short ?? 0),
      unit: row.minimum.unit,
      value: round(row.minimum.value),
    };

    if (row.met === false) {
      return t(
        "{unit, select, percent {At {score}, below the {minimum} it needs} other {{short, plural, one {# point} other {# points}} short of the {minimum} it needs}}",
        values,
      );
    }

    if (row.met) {
      return t(
        "{unit, select, percent {Reached the {minimum} it needs} other {Reached the {value, plural, one {# point} other {# points}} it needs}}",
        values,
      );
    }

    return t(
      "Needs {unit, select, percent {{minimum} of its points} other {{value, plural, one {# point} other {# points}}}}",
      values,
    );
  };
}

function TestRowScore({ row }: { row: TestRow }) {
  const t = useExtracted();
  const points = useMockNumber();

  return (
    <span className="shrink-0 font-mono text-xs tabular-nums">
      {row.projected === null
        ? t("{correct} of {total}", {
            correct: points(row.earned),
            total: points(row.max ?? row.asked),
          })
        : t("About {correct} of {total}", {
            correct: points(Math.round(row.projected)),
            total: points(row.max ?? row.asked),
          })}
    </span>
  );
}

function TestRowLines({ row }: { row: TestRow }) {
  const t = useExtracted();
  const requirement = useRequirementLine();
  const { minimum } = row;

  const lines = [
    minimum && requirement({ ...row, minimum }),
    row.qualifying && t("Doesn't count toward the total"),
  ].filter((line) => typeof line === "string");

  if (lines.length === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs",
        row.met === false ? "text-destructive-text" : "text-muted-foreground",
      )}
    >
      {row.met === false && <XIcon aria-hidden="true" className="size-3.5 shrink-0" />}
      {row.met === true && <CheckIcon aria-hidden="true" className="size-3.5 shrink-0" />}
      {lines.join(" · ")}
    </span>
  );
}

function TestRowItem({ row }: { row: TestRow }) {
  const t = useExtracted();

  return (
    <StepRow className="justify-between">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{row.name ?? t("Objective tests together")}</span>
        <TestRowLines row={row} />
      </span>
      <TestRowScore row={row} />
    </StepRow>
  );
}

/** What the result leads with when a test's minimum is missed, instead of the score. */
export function useMissedMinimum(
  points: MockPoints | null | undefined,
): { line: string; title: string } | null {
  const t = useExtracted();
  const formatMinimum = useFormatMinimum();
  const percent = useMockPercent();
  const [first] = hasTestRows(points) ? toTestRows(points) : [];

  if (first?.met !== false || !first.minimum) {
    return null;
  }

  return {
    line: t(
      "{unit, select, percent {At {score}. It needs {minimum}.} other {{short, plural, one {# point} other {# points}} short of the {minimum} it needs.}}",
      {
        minimum: formatMinimum(first.minimum),
        score: percent(toScorePercent(first)),
        short: round(first.short ?? 0),
        unit: first.minimum.unit,
      },
    ),
    title:
      first.name === null
        ? t("Below the minimum for the exam")
        : t("Below the minimum in {name}", { name: first.name }),
  };
}

/** True when the mock exam checked at least one minimum and every one was reached. */
export function reachedEveryMinimum(points: MockPoints | null | undefined): boolean {
  const rows = hasTestRows(points) ? toTestRows(points) : [];
  return rows.some((row) => row.met === true) && rows.every((row) => row.met !== false);
}

function ProjectedLine({ points }: { points: MockPoints }) {
  const t = useExtracted();
  const number = useMockNumber();

  if (points.projected === null || points.max === null) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-xs">
      {t("About {projected} of {max} points on the whole exam.", {
        max: number(points.max),
        projected: number(Math.round(points.projected)),
      })}
    </p>
  );
}

function UnjudgedLine({ entry }: { entry: MockPoints["unjudged"][number] }) {
  const t = useExtracted();
  const formatMinimum = useFormatMinimum();

  const values = {
    minimum: formatMinimum(entry.minimum),
    name: entry.name ?? "",
    unit: entry.minimum.unit,
    value: round(entry.minimum.value),
  };

  return (
    <p>
      {entry.name === null
        ? t(
            "The objective tests together need {unit, select, percent {{minimum} of their points} other {{value, plural, one {# point} other {# points}}}}, and this mock exam doesn't have them all.",
            values,
          )
        : t(
            "{name} needs {unit, select, percent {{minimum} of its points} other {{value, plural, one {# point} other {# points}}}} and isn't in this mock exam.",
            values,
          )}
    </p>
  );
}

export function MockResultPoints({ points }: { points: MockPoints }) {
  const t = useExtracted();
  const rows = toTestRows(points);

  return (
    <ResultSection rows title={t("By test")}>
      <div className="flex flex-col gap-3">
        {rows.length > 0 && (
          <StepRows>
            {rows.map((row) => (
              <TestRowItem key={row.name ?? "total"} row={row} />
            ))}
          </StepRows>
        )}

        <ProjectedLine points={points} />

        {points.unjudged.length > 0 && (
          <div className="text-muted-foreground flex flex-col gap-1 text-xs">
            {points.unjudged.map((entry) => (
              <UnjudgedLine entry={entry} key={entry.name ?? "total"} />
            ))}
          </div>
        )}
      </div>
    </ResultSection>
  );
}
