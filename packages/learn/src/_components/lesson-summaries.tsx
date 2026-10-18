"use client";

import { useExtracted } from "next-intl";
import { SectionLabel } from "./section-label";

/** A finished lesson's summary card: its title and every idea in one sentence. */
type LessonSummary = { ideas: string[]; lessonId: string; title: string };

/**
 * The summary cards a chapter's or unit's finished lessons left. Ideas are lesson text (math,
 * emphasis), so the host draws them the way lessons do.
 */
export function LessonSummaries({
  renderText,
  summaries,
}: {
  renderText: (text: string) => React.ReactNode;
  summaries: readonly LessonSummary[];
}) {
  const t = useExtracted();

  if (summaries.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="lesson-summaries-title" className="flex flex-col gap-3">
      <SectionLabel id="lesson-summaries-title">{t("Summaries")}</SectionLabel>
      <ul className="flex flex-col gap-4">
        {summaries.map((summary) => (
          <li className="flex flex-col gap-1.5" key={summary.lessonId}>
            <h3 className="text-sm font-medium">{summary.title}</h3>
            <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm">
              {summary.ideas.map((idea) => (
                <li key={idea}>{renderText(idea)}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
