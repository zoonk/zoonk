"use client";

import { useExtracted } from "next-intl";
import {
  DetailActions,
  DetailContinueLink,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailTitle,
  useDoneShare,
} from "../_components/detail-page";
import { PageEyebrow } from "../_components/page";
import { useFormatDuration } from "../_utils/time-format";
import { ContentFeedbackMenu } from "../feedback/content-feedback-menu";
import { LearnPageBar } from "../shell/learn-bar";
import { useChapterScreen } from "./chapter-context";

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

export function ChapterHeader() {
  const t = useExtracted();
  const { chapter, hrefs } = useChapterScreen();
  const { lessons } = chapter;
  const done = lessons.filter((lesson) => lesson.state === "done").length;
  const next = lessons.find((lesson) => lesson.state === "next");

  return (
    <DetailHero>
      <DetailHeroText>
        <PageEyebrow>
          {chapter.chapter.subject
            ? t("{subject} · Chapter {number, number}", {
                number: chapter.chapter.position,
                subject: chapter.chapter.subject.name,
              })
            : t("Chapter {number, number}", { number: chapter.chapter.position })}
        </PageEyebrow>
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
        <ContentFeedbackMenu
          label={t("Chapter options")}
          screen="chapter"
          size="detail"
          target={{ contentId: chapter.chapter.chapterId, contentKind: "chapter" }}
        />
      </DetailActions>
    </DetailHero>
  );
}

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
