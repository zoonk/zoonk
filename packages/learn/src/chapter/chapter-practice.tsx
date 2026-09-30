"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { BookmarkIcon, ChevronRightIcon, NotebookPenIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PracticeOutcomeMessage } from "../_components/practice-outcome-message";
import { SectionLabel } from "../_components/section-label";
import { usePracticeRun } from "../_utils/use-practice-run";
import { SummaryCardList } from "../content/summary-card-list";
import { LearnLink } from "../learn-link";
import { useChapterScreen } from "./chapter-context";

const TILE_CLASS =
  "bg-muted in-data-[mode=fun]:fun-glass flex min-h-28 flex-col justify-between gap-3 rounded-3xl p-4";

/** "Your mistakes · 2 to review", with "Practice": a short bonus block on this chapter's skills. */
function MistakesTile() {
  const t = useExtracted();
  const { actions, chapter, hrefs } = useChapterScreen();
  const { isPending, outcome, practice } = usePracticeRun(actions.practice);

  return (
    <div className={TILE_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <NotebookPenIcon aria-hidden="true" className="text-muted-foreground size-5" />
        <Button disabled={isPending} onClick={practice} size="sm" variant="outline">
          {t("Practice")}
        </Button>
      </div>
      <div className="flex flex-col">
        <LearnLink
          className="-my-2.5 py-2.5 font-medium underline-offset-4 hover:underline"
          href={hrefs.mistakes}
        >
          {t("Your mistakes")}
        </LearnLink>
        <span className="text-muted-foreground text-sm">
          {t("{count, plural, =0 {Nothing to review} one {# to review} other {# to review}}", {
            count: chapter.mistakes.open,
          })}
        </span>
      </div>
      <PracticeOutcomeMessage
        dailyCap={t(
          "That's all the bonus practice for today. Tomorrow's session picks this chapter up.",
        )}
        nothingToPractice={t("Nothing to practice in this chapter yet.")}
        outcome={outcome}
      />
    </div>
  );
}

function SummariesTile() {
  const t = useExtracted();
  const { chapter } = useChapterScreen();

  return (
    <a
      className={`${TILE_CLASS} focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]`}
      href="#chapter-summaries"
    >
      <div className="flex items-start justify-between gap-2">
        <BookmarkIcon aria-hidden="true" className="text-muted-foreground size-5" />
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-5" />
      </div>
      <div className="flex flex-col">
        <span className="font-medium">{t("Summaries")}</span>
        <span className="text-muted-foreground text-sm">
          {t("{count, plural, one {# saved} other {# saved}}", { count: chapter.summaries.length })}
        </span>
      </div>
    </a>
  );
}

/** The chapter's mistakes to practice, and the summary cards its finished lessons left. */
export function ChapterPractice() {
  const { chapter } = useChapterScreen();

  return (
    <div className={cn("grid gap-3", chapter.summaries.length > 0 && "grid-cols-2")}>
      <MistakesTile />
      {chapter.summaries.length > 0 && <SummariesTile />}
    </div>
  );
}

/** Each finished lesson's summary card: every idea in one sentence. */
export function ChapterSummaries() {
  const t = useExtracted();
  const { chapter } = useChapterScreen();

  if (chapter.summaries.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="chapter-summaries-title"
      className="flex scroll-mt-24 flex-col gap-3"
      id="chapter-summaries"
    >
      <SectionLabel id="chapter-summaries-title">{t("Summaries")}</SectionLabel>
      <SummaryCardList summaries={chapter.summaries} />
    </section>
  );
}
