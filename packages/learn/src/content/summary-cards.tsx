"use client";

import { useExtracted } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { useContentScreen } from "./content-context";
import { SummaryCardList } from "./summary-card-list";

/** Every finished lesson leaves its summary card here: each idea in one sentence. */
export function SummaryCards() {
  const t = useExtracted();
  const { content } = useContentScreen();

  if (content.summaries.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="summary-cards-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel id="summary-cards-title">{t("Lesson summaries")}</SectionLabel>
        <span className="text-muted-foreground text-xs">
          {t("{count, plural, one {# lesson} other {# lessons}}", { count: content.summaryCount })}
        </span>
      </div>
      <SummaryCardList summaries={content.summaries} />
    </section>
  );
}
