"use client";

import { useExtracted } from "next-intl";
import { type StudyQuestion } from "../session/session-types";

export type OptionSelect = NonNullable<StudyQuestion["select"]>;

export function isMultiPick(select: OptionSelect | null | undefined): select is OptionSelect {
  return select !== undefined && select !== null && select !== 1;
}

export function isCompletePick({
  picks,
  select,
}: {
  picks: readonly number[];
  select: OptionSelect;
}): boolean {
  return select === "all" ? picks.length > 0 : picks.length === select;
}

export function togglePick(picks: readonly number[], index: number): number[] {
  return picks.includes(index) ? picks.filter((pick) => pick !== index) : [...picks, index];
}

export function PickRule({ select }: { select: OptionSelect }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-sm font-medium">
      {select === "all"
        ? t("Select all that apply.")
        : t("{count, plural, one {Choose # option.} other {Choose # options.}}", { count: select })}
    </p>
  );
}
