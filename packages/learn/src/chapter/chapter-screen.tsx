"use client";

import { type ChapterMindMapView } from "@zoonk/core/mind-maps/contract";
import { type ChapterView } from "@zoonk/core/view-models/chapter/contract";
import { ListChecksIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  DetailAside,
  DetailAsideSection,
  DetailContent,
  DetailLayout,
} from "../_components/detail-page";
import { Disclosure } from "../_components/disclosure";
import { type MindMapLimit } from "../_components/help-limit-notice";
import { LessonList, LessonProgress } from "../_components/lesson-list";
import { LessonSummaries } from "../_components/lesson-summaries";
import { ListGroup, ListRowIcon } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { SectionLabel } from "../_components/section-label";
import { SkillList } from "../_components/skill-list";
import { TestOutStartRow } from "../_components/test-out-start-link";
import { type MindMapActions } from "../mind-maps/mind-map-actions";
import { MindMapCard } from "../mind-maps/mind-map-card";
import {
  type ChapterActions,
  type ChapterHrefs,
  ChapterScreenProvider,
  useChapterScreen,
} from "./chapter-context";
import { ChapterBar, ChapterHeader } from "./chapter-header";
import { ChapterMistakes } from "./chapter-mistakes";

export type { AreaPracticeOutcome } from "../_utils/use-practice-run";
export type { TestOutStart } from "../_components/test-out-start-link";
export type { ChapterActions, ChapterHrefs } from "./chapter-context";

/**
 * The chapter's mind map and what the host does for it, with the cap of the learner's plan its
 * maps already reached (`cap`); null for a language's unit.
 */
export type ChapterMindMap = {
  actions: MindMapActions;
  cap?: MindMapLimit | null;
  view: ChapterMindMapView;
};

const PRACTICE_TITLE_ID = "chapter-practice-title";
const PROGRESS_TITLE_ID = "chapter-progress-title";
const REFERENCE_TITLE_ID = "chapter-reference-title";

/**
 * "For reference": once the learner finished the chapter, its mind map (or the tap that makes it);
 * then, folded, the chapter's skills with their state and the summaries its lessons left. Screen
 * readers hear the map in words as its picture's description.
 */
function ChapterSummary({
  mindMap,
  renderLessonText,
}: {
  mindMap: ChapterMindMap | null;
  renderLessonText: (text: string) => React.ReactNode;
}) {
  const t = useExtracted();
  const { chapter } = useChapterScreen();
  const map = mindMap?.view.status === "unavailable" ? null : mindMap;
  const hasSummary = chapter.skills.length > 0 || chapter.summaries.length > 0;

  if (!map && !hasSummary) {
    return null;
  }

  return (
    <PageSection aria-labelledby={REFERENCE_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={REFERENCE_TITLE_ID}>{t("For reference")}</PageSectionTitle>
      </PageSectionHeader>

      {map && (
        <MindMapCard
          actions={map.actions}
          cap={map.cap ?? null}
          chapterTitle={chapter.chapter.title}
          mindMap={map.view}
        />
      )}

      {hasSummary && (
        <ListGroup>
          <Disclosure
            icon={
              <ListRowIcon>
                <ListChecksIcon />
              </ListRowIcon>
            }
            title={t("Chapter summary")}
          >
            {chapter.skills.length > 0 && (
              <section aria-labelledby="chapter-skills-title" className="flex flex-col gap-1">
                <SectionLabel id="chapter-skills-title">{t("Skills")}</SectionLabel>
                <SkillList skills={chapter.skills} />
              </section>
            )}
            <LessonSummaries renderText={renderLessonText} summaries={chapter.summaries} />
          </Disclosure>
        </ListGroup>
      )}
    </PageSection>
  );
}

/** Other study actions on the chapter: general practice and testing past lessons already known. */
function ChapterPractice() {
  const t = useExtracted();
  const { actions, chapter } = useChapterScreen();
  const canTestOut = chapter.testOut.available;

  if (!canTestOut && chapter.mistakes.open === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby={PRACTICE_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={PRACTICE_TITLE_ID}>{t("Practice")}</PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
        {canTestOut && (
          <TestOutStartRow
            onStart={actions.startTestOut}
            plusRequired={chapter.testOut.plusRequired}
            scope="chapter"
          />
        )}
        <ChapterMistakes />
      </ListGroup>
    </PageSection>
  );
}

/** How far the learner is in the chapter, as one segment per lesson ("1 of 3"), in the aside. */
function ChapterProgress() {
  const t = useExtracted();
  const { chapter } = useChapterScreen();
  const { lessons } = chapter;
  const done = lessons.filter((lesson) => lesson.state === "done").length;

  if (lessons.length === 0) {
    return null;
  }

  return (
    <DetailAsideSection
      className="hidden min-[72rem]:flex"
      detail={t("{done, number} of {total, number}", { done, total: lessons.length })}
      title={t("Progress")}
      titleId={PROGRESS_TITLE_ID}
    >
      <LessonProgress lessons={lessons} />
    </DetailAsideSection>
  );
}

function ChapterBody({
  mindMap,
  renderLessonText,
}: {
  mindMap: ChapterMindMap | null;
  renderLessonText: (text: string) => React.ReactNode;
}) {
  const t = useExtracted();
  const { chapter, hrefs } = useChapterScreen();

  return (
    <DetailLayout
      aside={
        <>
          <ChapterProgress />
          <ChapterPractice />
          <ChapterSummary mindMap={mindMap} renderLessonText={renderLessonText} />
        </>
      }
      asideLabel={t("About this chapter")}
      bar={<ChapterBar />}
      data-slot="chapter"
    >
      <DetailAside>
        <ChapterHeader />
      </DetailAside>

      <DetailContent>
        {chapter.lessons.length > 0 && (
          <LessonList
            lessonHref={(lessonId) => `${hrefs.lessonBasePath}/${lessonId}`}
            lessons={chapter.lessons}
            // In any chapter, the lesson "Start" or "Continue" opens is marked as next.
            upNext
          />
        )}
      </DetailContent>
    </DetailLayout>
  );
}

/**
 * A chapter of the learner's plan: its number and lessons done with "Continue" beside its name, its
 * lessons in order (the next one marked), and in the aside from 72rem (after the lessons under
 * it) how far the learner is, a test that skips a chapter they may already know, its mistakes when
 * there are some, and for reference its mind map, its skills and the summaries its lessons left.
 *
 * ```tsx
 * <ChapterScreen
 *   actions={{ practice, startTestOut }}
 *   chapter={chapter}
 *   hrefs={{ back: "/plan", lessonBasePath: "/learn" }}
 *   renderLessonText={(text) => <LessonRichText text={text} />}
 * />
 * ```
 */
export function ChapterScreen({
  actions,
  ask,
  chapter,
  hrefs,
  mindMap = null,
  renderLessonText,
}: {
  actions: ChapterActions;
  /** "Ask" about the chapter, such as the player's `AskTutor`; the host decides who can ask. */
  ask?: React.ReactNode;
  chapter: ChapterView;
  hrefs: ChapterHrefs;
  mindMap?: ChapterMindMap | null;
  /** Summary ideas are lesson text (math, emphasis): the host draws them as lessons do. */
  renderLessonText: (text: string) => React.ReactNode;
}) {
  return (
    <ChapterScreenProvider value={{ actions, ask, chapter, hrefs }}>
      <ChapterBody mindMap={mindMap} renderLessonText={renderLessonText} />
    </ChapterScreenProvider>
  );
}
