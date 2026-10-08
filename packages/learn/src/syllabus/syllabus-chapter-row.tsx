"use client";

import { type SyllabusChapter } from "@zoonk/core/view-models/syllabus/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ChapterMark } from "../_components/chapter-mark";
import {
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { useFormatIsoDate } from "../_utils/iso-date";

/** What sits at the end of a chapter's row: when the plan gets to it, or nothing once done or next. */
function ChapterMeta({ chapter }: { chapter: SyllabusChapter }) {
  const formatDate = useFormatIsoDate();

  if (chapter.state !== "upcoming" || !chapter.nextDate) {
    return null;
  }

  return formatDate(chapter.nextDate, "day");
}

/** The line under a chapter's name: lessons still being written, or "1 lesson · up next" for the next one. */
function ChapterLine({ chapter }: { chapter: SyllabusChapter }) {
  const t = useExtracted();

  if (chapter.writing) {
    return <ListRowDescription>{t("Lessons on the way")}</ListRowDescription>;
  }

  if (chapter.state !== "current") {
    return null;
  }

  const left = Math.max(0, chapter.lessonsTotal - chapter.lessonsDone);

  return (
    <ListRowDescription>
      {left > 0
        ? t("{count, plural, one {# lesson · up next} other {# lessons · up next}}", {
            count: left,
          })
        : t("Up next")}
    </ListRowDescription>
  );
}

/**
 * A chapter of a subject: its mark, its number in the subject and name and when the plan gets to
 * it, opening its page; the next one stands out with what's left in it. Lessons still being
 * written have no page yet, so their row only says so.
 */
export function SyllabusChapterRow({
  chapter,
  href,
}: {
  chapter: SyllabusChapter;
  /** Its page; null while its lessons are being written. */
  href: string | null;
}) {
  const isNext = chapter.state === "current";

  const content = (
    <>
      <ListRowLeading>
        <ChapterMark chapter={chapter} isNext={isNext} />
      </ListRowLeading>
      <ListRowContent className="min-h-13 py-2.5">
        <ListRowTitle
          className={cn(
            "line-clamp-2",
            chapter.state === "done" && "text-muted-foreground",
            isNext && "font-semibold",
          )}
        >
          <span className="text-muted-foreground font-normal tabular-nums">{`${chapter.position}. `}</span>
          {chapter.title}
        </ListRowTitle>
        <ChapterLine chapter={chapter} />
      </ListRowContent>
      <ListRowTrailing>
        <ChapterMeta chapter={chapter} />
      </ListRowTrailing>
    </>
  );

  const className = cn(isNext && "bg-muted/50");

  if (!href) {
    return <ListRow className={className}>{content}</ListRow>;
  }

  return (
    <ListRowLink className={className} href={href}>
      {content}
    </ListRowLink>
  );
}
