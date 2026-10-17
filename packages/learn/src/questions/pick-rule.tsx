"use client";

import { useExtracted } from "next-intl";
import { type StudyQuestion } from "../session/session-types";

/** How many options a question asks the learner to pick: one, an exact number or "all". */
export type OptionSelect = NonNullable<StudyQuestion["select"]>;

/** Whether a question is answered with several picks: an exact number of them, or "all". */
export function isMultiPick(select: OptionSelect | null | undefined): select is OptionSelect {
  return select !== undefined && select !== null && select !== 1;
}

/** Whether the picks can be sent: exactly as many as the question asks, or at least one for "all". */
export function isCompletePick({
  picks,
  select,
}: {
  picks: readonly number[];
  select: OptionSelect;
}): boolean {
  return select === "all" ? picks.length > 0 : picks.length === select;
}

/** A pick toggled: in when it wasn't picked, out when it was. */
export function togglePick(picks: readonly number[], index: number): number[] {
  return picks.includes(index) ? picks.filter((pick) => pick !== index) : [...picks, index];
}

/** The rule above a question that asks for several options, as exams word it. */
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
