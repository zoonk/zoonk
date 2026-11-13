"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import {
  DetailActions,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailTitle,
} from "@zoonk/ui/components/detail";
import { useExtracted } from "next-intl";
import { DetailContinueLink, useDoneShare } from "../_components/detail-page";
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

  const facts = [
    t("Chapter {number, number}", { number: chapter.chapter.position }),
    lessons.length > 0 &&
      t("{count, plural, one {# lesson} other {# lessons}}", { count: lessons.length }),
    minutes > 0 && formatDuration(minutes),
    lessons.length > 0 && doneShare(done / lessons.length),
  ].filter(Boolean);

  return <DetailFacts>{facts.join(" · ")}</DetailFacts>;
}

export function ChapterHeader() {
  const t = useExtracted();
  const { chapter } = useChapterScreen();

  return (
    <DetailHero>
      <DetailHeroText>
        <DetailTitle>{chapter.chapter.title}</DetailTitle>
        <ChapterFacts />
      </DetailHeroText>

      <DetailActions>
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

/** The chapter's main action, pinned under the page: the next lesson to study. */
export function ChapterBottomBar() {
  const { chapter, hrefs } = useChapterScreen();
  const { lessons } = chapter;
  const next = lessons.find((lesson) => lesson.state === "next");

  if (!next) {
    return null;
  }

  return (
    <BottomBar>
      <BottomBarActions>
        <DetailContinueLink
          href={`${hrefs.lessonBasePath}/${next.lessonId}`}
          lessonWritten={next.written}
          started={lessons.some((lesson) => lesson.state === "done")}
        />
      </BottomBarActions>
    </BottomBar>
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
