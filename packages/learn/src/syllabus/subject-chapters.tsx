"use client";

import { type SyllabusChapter } from "@zoonk/core/view-models/syllabus/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  FoldChevron,
} from "@zoonk/ui/components/collapsible";
import { NetworkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import {
  LIST_ROW_INTERACTIVE_CLASS,
  ListGroup,
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
import { LeftOutTopicsRow } from "../journey/journey-chapters";
import { LearnLink } from "../learn-link";
import { FoldRow } from "../today/today-fold-row";
import { getDoneChapters } from "./done-chapters";
import { SyllabusChapterRow } from "./syllabus-chapter-row";

const CHAPTERS_TITLE_ID = "subject-chapters-title";

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
        "{count, plural, one {# chapter you already know} other {# chapters you already know}}",
        { count: known },
      );
    }

    return t(
      "{done, plural, one {# chapter done} other {# chapters done}}, {known, plural, one {# you already know} other {# you already know}}",
      { done, known },
    );
  };
}

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
      <CollapsibleTrigger className={LIST_ROW_INTERACTIVE_CLASS}>
        <ListRowLeading>
          <StatusMark status={chapters.every((chapter) => chapter.known) ? "skipped" : "done"} />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle className="text-muted-foreground">{doneLine(chapters)}</ListRowTitle>
        </ListRowContent>
        <FoldChevron />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="flex flex-col [&>li]:border-t">
          <ChapterRows chapterHref={chapterHref} chapters={chapters} />
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MindMapsLink({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <LearnLink
      className={buttonVariants({ className: "-my-1", edge: "end", size: "sm", variant: "ghost" })}
      href={href}
    >
      <NetworkIcon aria-hidden="true" data-icon="inline-start" />
      {t("Mind maps")}
    </LearnLink>
  );
}

/** Why the fold above leaves topics out, and the way to fit them in. */
function LeftOutWhy({ adjustHref }: { adjustHref: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-start gap-3 pt-2" data-slot="left-out-why">
      <p className="text-muted-foreground text-sm">
        {t({
          description:
            "Under the folded list of a module's or a subject's topics that the learner's plan leaves out: they don't fit in the study time before the date the learner set. Followed by a button to change the plan.",
          message: "They don't fit before your date.",
        })}
      </p>
      <LearnLink className={buttonVariants({ size: "lg", variant: "outline" })} href={adjustHref}>
        {t("Adjust plan")}
      </LearnLink>
    </div>
  );
}

export function SubjectChapters({
  adjustHref,
  chapterHref,
  chapters,
  leftOut,
  mindMapsHref,
}: {
  adjustHref: string;
  chapterHref: (chapterId: string) => string;
  chapters: readonly SyllabusChapter[];
  /** Its topics the plan's date leaves out, folded after the chapters it keeps. */
  leftOut: readonly string[];
  mindMapsHref: string | null;
}) {
  const t = useExtracted();
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const done = getDoneChapters(chapters);
  const ahead = chapters.filter((chapter) => chapter.state !== "done");
  const shown = showAll ? ahead : ahead.slice(0, SHOWN_UPCOMING + 1);
  const hidden = ahead.length - shown.length;

  if (chapters.length === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby={CHAPTERS_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={CHAPTERS_TITLE_ID}>{t("Chapters")}</PageSectionTitle>
        <span className="flex items-center gap-3">
          <PageSectionDetail>
            {t("{done, number} of {total, number} chapters", {
              done: done.length,
              total: chapters.length,
            })}
          </PageSectionDetail>
          {mindMapsHref && <MindMapsLink href={mindMapsHref} />}
        </span>
      </PageSectionHeader>

      <ListGroup as="ul" id={listId}>
        {done.length > 0 && (
          <li>
            <DoneChapters chapterHref={chapterHref} chapters={done} />
          </li>
        )}

        <ChapterRows chapterHref={chapterHref} chapters={shown} />

        {hidden > 0 && (
          <li>
            <FoldRow
              controls={listId}
              done={false}
              label={t("{count, plural, one {# more chapter} other {# more chapters}}", {
                count: hidden,
              })}
              onToggle={() => setShowAll(true)}
              open={showAll}
            />
          </li>
        )}
      </ListGroup>

      {leftOut.length > 0 && (
        // Flush under the list and divided like its rows, though outside it: it isn't a chapter.
        <div className="-mt-3 flex flex-col border-t">
          <LeftOutTopicsRow names={leftOut} />
          <LeftOutWhy adjustHref={adjustHref} />
        </div>
      )}
    </PageSection>
  );
}
