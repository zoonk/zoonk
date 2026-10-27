"use client";

import { useExtracted } from "next-intl";
import {
  DetailActions,
  DetailContinueLink,
  DetailEyebrow,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailTitle,
  useDoneShare,
} from "../_components/detail-page";
import { useFormatDuration } from "../_utils/time-format";
import { ContentVoteMenu } from "../feedback/content-vote-menu";
import { LearnPageBar } from "../shell/learn-bar";
import { useChapterScreen } from "./chapter-context";

/**
 * "11 lessons · 40 min · 33% done": how much the chapter holds and how far the learner is. The time
 * is its lessons' minutes added up, so it reads like the rows under it and the public chapter page.
 */
function ChapterFacts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const doneShare = useDoneShare();
  const { chapter } = useChapterScreen();
  const { lessons } = chapter;
  const minutes = lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
  const done = lessons.filter((lesson) => lesson.state === "done").length;

  if (lessons.length === 0) {
    return null;
  }

  const facts = [
    t("{count, plural, one {# lesson} other {# lessons}}", { count: lessons.length }),
    minutes > 0 && formatDuration(minutes),
    doneShare(done / lessons.length),
  ].filter(Boolean);

  return <DetailFacts>{facts.join(" · ")}</DetailFacts>;
}

/**
 * The chapter's subject and number there (as the subject's page numbers it), its title, how much it
 * holds and how far the learner is, and "Continue" into the next lesson with the chapter's "…"
 * beside it (beside the title from `md`).
 */
export function ChapterHeader() {
  const t = useExtracted();
  const { chapter, hrefs } = useChapterScreen();
  const { lessons } = chapter;
  const done = lessons.filter((lesson) => lesson.state === "done").length;
  const next = lessons.find((lesson) => lesson.state === "next");

  return (
    <DetailHero>
      <DetailHeroText>
        <DetailEyebrow>
          {chapter.chapter.subject
            ? t("{subject} · Chapter {number, number}", {
                number: chapter.chapter.position,
                subject: chapter.chapter.subject.name,
              })
            : t("Chapter {number, number}", { number: chapter.chapter.position })}
        </DetailEyebrow>
        <DetailTitle>{chapter.chapter.title}</DetailTitle>
        <ChapterFacts />
      </DetailHeroText>

      <DetailActions className="empty:hidden">
        {next && (
          <DetailContinueLink
            href={`${hrefs.lessonBasePath}/${next.lessonId}`}
            lessonWritten={next.written}
            started={done > 0}
          />
        )}
        <ContentVoteMenu
          label={t("Chapter options")}
          screen="chapter"
          size="detail"
          target={{ contentId: chapter.chapter.chapterId, contentKind: "chapter" }}
          votes={false}
        />
      </DetailActions>
    </DetailHero>
  );
}

/**
 * The chapter's bar: back to the Plan (or the subject it was opened from), and "Ask" on the
 * right; the chapter's "…" sits beside its main action.
 */
export function ChapterBar() {
  const t = useExtracted();
  const { ask, chapter, hrefs } = useChapterScreen();

  return (
    <LearnPageBar
      back={{ href: hrefs.back, label: hrefs.backLabel ?? t("Plan") }}
      title={chapter.chapter.title}
    >
      {ask}
    </LearnPageBar>
  );
}
