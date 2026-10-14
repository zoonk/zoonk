"use client";

import { type SyllabusChapter } from "@zoonk/core/view-models/syllabus/contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  LIST_GROUP_CLASS,
  LIST_ROW_INTERACTIVE_CLASS,
  ListRowButton,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { StatusMark } from "../_components/status-mark";
import { SyllabusChapterRow } from "./syllabus-chapter-row";

const CHAPTERS_TITLE_ID = "subject-chapters-title";

/** Chapters after the next one in sight before "N more chapters". */
const SHOWN_UPCOMING = 4;

function ChapterRows({
  chapterHref,
  chapters,
}: {
  chapterHref: (chapterId: string) => string;
  chapters: readonly SyllabusChapter[];
}) {
  return chapters.map((chapter) => (
    <li
      aria-current={chapter.state === "current" ? "step" : undefined}
      key={chapter.chapterId ?? chapter.title}
    >
      <SyllabusChapterRow
        chapter={chapter}
        chapterHref={chapterHref}
        href={chapter.chapterId ? chapterHref(chapter.chapterId) : null}
      />
    </li>
  ));
}

/**
 * "4 chapters done, 2 skipped because you already know them": the ones studied, and apart, the
 * ones skipped because the learner showed they know them.
 */
function useDoneLine() {
  const t = useExtracted();

  return (chapters: readonly SyllabusChapter[]): string => {
    const known = chapters.filter((chapter) => chapter.known).length;
    const done = chapters.length - known;

    if (known === 0) {
      return t("{count, plural, one {# chapter done} other {# chapters done}}", { count: done });
    }

    if (done === 0) {
      return t(
        "{count, plural, one {# chapter skipped because you already know it} other {# chapters skipped because you already know them}}",
        { count: known },
      );
    }

    return t(
      "{done, plural, one {# chapter done} other {# chapters done}}, {known, plural, one {# skipped because you already know it} other {# skipped because you already know them}}",
      { done, known },
    );
  };
}

/** The chapters already done, folded into the list's first row, opening them in place. */
function DoneChapters({
  chapterHref,
  chapters,
}: {
  chapterHref: (chapterId: string) => string;
  chapters: readonly SyllabusChapter[];
}) {
  const doneLine = useDoneLine();

  return (
    <Collapsible>
      <CollapsibleTrigger className={cn(LIST_ROW_INTERACTIVE_CLASS, "group/done")}>
        <ListRowLeading>
          {/* Every folded chapter skipped because the learner knows it: the skip mark, as each. */}
          <StatusMark status={chapters.every((chapter) => chapter.known) ? "skipped" : "done"} />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle className="text-muted-foreground">{doneLine(chapters)}</ListRowTitle>
        </ListRowContent>
        <ChevronDownIcon
          aria-hidden="true"
          className="text-muted-foreground/60 size-4 shrink-0 self-center transition-transform group-data-panel-open/done:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <ul className="flex flex-col [&>li]:border-t">
          <ChapterRows chapterHref={chapterHref} chapters={chapters} />
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * A subject's chapters under their header, the way in to study it: the ones done folded into the
 * list's first row, the next one marked, then the ones after it in the plan's order (the first few
 * in sight, the rest one tap away), so a subject with forty chapters still leads with what to do.
 * The header counts the chapters studied; the ones skipped because the learner knows them aren't.
 */
export function SubjectChapters({
  chapterHref,
  chapters,
}: {
  chapterHref: (chapterId: string) => string;
  chapters: readonly SyllabusChapter[];
}) {
  const t = useExtracted();
  const [showAll, setShowAll] = useState(false);
  const done = chapters.filter((chapter) => chapter.state === "done");
  const studied = done.filter((chapter) => !chapter.known);
  const ahead = chapters.filter((chapter) => chapter.state !== "done");
  // The next one and the few after it.
  const shown = showAll ? ahead : ahead.slice(0, SHOWN_UPCOMING + 1);
  const hidden = ahead.length - shown.length;

  if (chapters.length === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby={CHAPTERS_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={CHAPTERS_TITLE_ID}>{t("Chapters")}</PageSectionTitle>
        <PageSectionDetail>
          {t("{done, number} of {total, number}", { done: studied.length, total: chapters.length })}
        </PageSectionDetail>
      </PageSectionHeader>

      <ul className={LIST_GROUP_CLASS}>
        {done.length > 0 && (
          <li>
            <DoneChapters chapterHref={chapterHref} chapters={done} />
          </li>
        )}

        <ChapterRows chapterHref={chapterHref} chapters={shown} />

        {hidden > 0 && (
          <li>
            <ListRowButton chevron={false} onClick={() => setShowAll(true)}>
              <ListRowLeading className="text-muted-foreground size-4 justify-center">
                <PlusIcon aria-hidden="true" className="size-3.5" />
              </ListRowLeading>
              <ListRowContent>
                <ListRowTitle className="text-muted-foreground">
                  {t("{count, plural, one {# more chapter} other {# more chapters}}", {
                    count: hidden,
                  })}
                </ListRowTitle>
              </ListRowContent>
            </ListRowButton>
          </li>
        )}
      </ul>
    </PageSection>
  );
}
