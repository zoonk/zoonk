"use client";

import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { useExtracted } from "next-intl";
import { FactSegments } from "../_components/task-meta";

export function NotebookAvailabilityText({
  availability,
  fixed,
}: {
  availability: MistakeAvailability;
  fixed: number;
}) {
  const t = useExtracted();
  const { ready, tomorrow } = availability;

  const counts = [
    (ready > 0 || tomorrow === 0) &&
      t(
        "{count, plural, =0 {# ready to practice} one {# ready to practice} other {# ready to practice}}",
        { count: ready },
      ),
    tomorrow > 0 &&
      t(
        "{count, plural, =0 {# available tomorrow} one {# available tomorrow} other {# available tomorrow}}",
        { count: tomorrow },
      ),
    t("{count, plural, =0 {# fixed} one {# fixed} other {# fixed}}", { count: fixed }),
  ].filter((count) => count !== false);

  return (
    <span>
      <FactSegments facts={counts} />
    </span>
  );
}
