"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { StepRow, StepRows } from "../_components/step-card";
import { ResultSection } from "./mock-result-section";

type MockPoints = NonNullable<MockResult["points"]>;
type Minimum = MockPoints["unjudged"][number]["minimum"];
type Tally = Omit<MockPoints, "parts" | "unjudged">;
type TestRow = Tally & { name: string | null; qualifying: boolean };

const POINT_DECIMALS = 100;

function round(value: number): number {
  return Math.round(value * POINT_DECIMALS) / POINT_DECIMALS;
}

function toScorePercent({ asked, earned }: Tally): number {
  return asked > 0 ? (earned / asked) * 100 : 0;
}

/** Misses first, so what would eliminate the learner is read before what went fine. */
function toTestRows(points: MockPoints): TestRow[] {
  const total = points.minimum ? [{ ...points, name: null, qualifying: false }] : [];
  const rows = [...points.parts, ...total];

  return [...rows.filter((row) => row.met === false), ...rows.filter((row) => row.met !== false)];
}

export function hasTestRows(points: MockPoints | null | undefined): points is MockPoints {
  return Boolean(
    points && (points.parts.length > 0 || points.minimum || points.unjudged.length > 0),
  );
}

function useFormatPoints() {
  const format = useFormatter();
  return (value: number) => format.number(round(value), { maximumFractionDigits: 2 });
}

function useFormatPercent() {
  const format = useFormatter();

  return (value: number) =>
    format.number(value / 100, { maximumFractionDigits: 1, style: "percent" });
}

function useFormatMinimum() {
  const points = useFormatPoints();
  const percent = useFormatPercent();

  return (minimum: Minimum) =>
    minimum.unit === "percent" ? percent(minimum.value) : points(minimum.value);
}

function useRequirementLine() {
  const t = useExtracted();
  const formatMinimum = useFormatMinimum();
  const percent = useFormatPercent();

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
  const points = useFormatPoints();

  return (
    <span className="shrink-0 font-mono text-xs tabular-nums">
      {t("{correct} of {total}", {
        correct: points(row.projected ?? row.earned),
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

function useMissSentence() {
  const t = useExtracted();
  const formatMinimum = useFormatMinimum();
  const percent = useFormatPercent();

  return (row: TestRow & { minimum: Minimum }): string => {
    const values = {
      minimum: formatMinimum(row.minimum),
      name: row.name ?? "",
      score: percent(toScorePercent(row)),
      short: round(row.short ?? 0),
      unit: row.minimum.unit,
    };

    if (row.name === null) {
      return t(
        "You'd be eliminated: the objective tests together {unit, select, percent {reach {score}, below the {minimum} they need} other {are {short, plural, one {# point} other {# points}} short of {minimum}}}.",
        values,
      );
    }

    return t(
      "You'd be eliminated: {name} {unit, select, percent {is at {score}, below the {minimum} it needs} other {is {short, plural, one {# point} other {# points}} short of {minimum}}}.",
      values,
    );
  };
}

function Verdict({ rows }: { rows: readonly TestRow[] }) {
  const t = useExtracted();
  const missSentence = useMissSentence();
  const [first] = rows;

  if (!rows.some((row) => row.met !== null)) {
    return null;
  }

  if (first?.met === false && first.minimum) {
    return (
      <p className="text-destructive-text flex items-start gap-2 text-sm font-medium">
        <XIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {missSentence({ ...first, minimum: first.minimum })}
      </p>
    );
  }

  return (
    <p className="flex items-start gap-2 text-sm font-medium">
      <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {t("Meets the objective minimums checked here.")}
    </p>
  );
}

function ProjectedLine({ points }: { points: MockPoints }) {
  const t = useExtracted();
  const format = useFormatPoints();
  const projects = points.projected !== null || points.parts.some((part) => part.projected);

  if (!projects) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-xs">
      {points.projected !== null && points.max !== null
        ? t(
            "About {projected} of {max} points on the whole exam, projected from this mock. Only a full mock says whether you'd reach the minimums.",
            { max: format(points.max), projected: format(points.projected) },
          )
        : t(
            "Each test's points are projected onto its whole length. Only a full mock says whether you'd reach the minimums.",
          )}
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
            "The objective tests together need {unit, select, percent {{minimum} of their points} other {{value, plural, one {# point} other {# points}}}}, and this mock doesn't have them all.",
            values,
          )
        : t(
            "{name} needs {unit, select, percent {{minimum} of its points} other {{value, plural, one {# point} other {# points}}}} and isn't in this mock.",
            values,
          )}
    </p>
  );
}

export function MockResultPoints({ points }: { points: MockPoints }) {
  const t = useExtracted();
  const rows = toTestRows(points);

  return (
    <ResultSection title={t("By test")}>
      <div className="flex flex-col gap-3">
        <Verdict rows={rows} />
        <ProjectedLine points={points} />

        {rows.length > 0 && (
          <StepRows>
            {rows.map((row) => (
              <TestRowItem key={row.name ?? "total"} row={row} />
            ))}
          </StepRows>
        )}

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
