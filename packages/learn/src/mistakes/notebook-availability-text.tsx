"use client";

import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { useExtracted } from "next-intl";
import { FactSegments } from "../_components/task-meta";

/**
 * The notebook's counts under its name ("3 ready to practice · 3 available tomorrow · 1 fixed"),
 * each a segment of its own, so a phone wraps the line between counts and never inside one.
 * Tomorrow's count shows only when there are some; the ready count whenever it's the news.
 */
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

  // One inline run inside the facts' flex row, so lines break only at the spaces between counts.
  return (
    <span>
      <FactSegments facts={counts} />
    </span>
  );
}
