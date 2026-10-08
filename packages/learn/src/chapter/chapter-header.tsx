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
} from "../_components/detail-page";
import { KindTile } from "../_components/kind-tile";
import { ContentVoteMenu } from "../feedback/content-vote-menu";
import { LearnPageBar } from "../shell/learn-bar";
import { useChapterScreen } from "./chapter-context";

/** "11 lessons · About 40 min": how much the chapter holds. */
function ChapterFacts() {
  const t = useExtracted();
  const { chapter } = useChapterScreen();
  const { lessons } = chapter;
  const minutes = lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);

  if (lessons.length === 0) {
    return null;
  }

  const facts = [
    t("{count, plural, one {# lesson} other {# lessons}}", { count: lessons.length }),
    minutes > 0 && t("About {minutes, number} min", { minutes }),
  ].filter(Boolean);

  return <DetailFacts>{facts.join(" · ")}</DetailFacts>;
}

/**
 * The chapter's tile, its subject and number there (as the subject's page numbers it), its title,
 * how much it holds, then "Continue" into the next lesson with how far the learner is in the
 * chapter and the chapter's "…" beside it.
 */
export function ChapterHeader() {
  const t = useExtracted();
  const { chapter, hrefs } = useChapterScreen();
  const { lessons } = chapter;
  const done = lessons.filter((lesson) => lesson.state === "done").length;
  const next = lessons.find((lesson) => lesson.state === "next");

  return (
    <>
      <DetailHero>
        <KindTile kind="lesson" size="lg" />
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
      </DetailHero>

      <DetailActions className="empty:hidden">
        {next && (
          <DetailContinueLink
            href={`${hrefs.lessonBasePath}/${next.lessonId}`}
            share={lessons.length > 0 ? done / lessons.length : 0}
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
    </>
  );
}

/**
 * The chapter's bar: back to the Journey (or the subject it was opened from), and "Ask" on the
 * right; the chapter's "…" sits beside its main action.
 */
export function ChapterBar() {
  const t = useExtracted();
  const { ask, chapter, hrefs } = useChapterScreen();

  return (
    <LearnPageBar
      back={{ href: hrefs.back, label: hrefs.backLabel ?? t("Journey") }}
      title={chapter.chapter.title}
    >
      {ask}
    </LearnPageBar>
  );
}
