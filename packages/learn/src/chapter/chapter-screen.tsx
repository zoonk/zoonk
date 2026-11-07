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
import { LessonList, LessonProgress } from "../_components/lesson-list";
import { LessonSummaries } from "../_components/lesson-summaries";
import { ListGroup, ListRowIcon } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { SectionLabel } from "../_components/section-label";
import { SkillList } from "../_components/skill-list";
import { TestOutStartRow } from "../_components/test-out-start-link";
import { type MindMapActions } from "../mind-maps/mind-map-actions";
import { MindMapRow } from "../mind-maps/mind-map-row";
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

type ChapterMindMap = { actions: MindMapActions; plus: boolean; view: ChapterMindMapView };

const PRACTICE_TITLE_ID = "chapter-practice-title";
const PROGRESS_TITLE_ID = "chapter-progress-title";
const REFERENCE_TITLE_ID = "chapter-reference-title";

function ChapterSummary({
  renderLessonText,
}: {
  renderLessonText: (text: string) => React.ReactNode;
}) {
  const t = useExtracted();
  const { chapter } = useChapterScreen();

  if (chapter.skills.length === 0 && chapter.summaries.length === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby={REFERENCE_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={REFERENCE_TITLE_ID}>{t("For reference")}</PageSectionTitle>
      </PageSectionHeader>

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
    </PageSection>
  );
}

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
          <ChapterSummary renderLessonText={renderLessonText} />
        </>
      }
      asideLabel={t("About this chapter")}
      bar={<ChapterBar />}
      data-slot="chapter"
    >
      <DetailAside>
        <ChapterHeader />
        {mindMap && mindMap.view.status !== "unavailable" && (
          <MindMapRow
            actions={mindMap.actions}
            place="chapter"
            plus={mindMap.plus}
            view={mindMap.view}
          />
        )}
      </DetailAside>

      <DetailContent>
        {chapter.lessons.length > 0 && (
          <LessonList
            lessonHref={(lessonId) => `${hrefs.lessonBasePath}/${lessonId}`}
            lessons={chapter.lessons}
            upNext
          />
        )}
      </DetailContent>
    </DetailLayout>
  );
}

export function ChapterScreen({
  actions,
  ask,
  chapter,
  hrefs,
  mindMap = null,
  renderLessonText,
}: {
  actions: ChapterActions;
  ask?: React.ReactNode;
  chapter: ChapterView;
  hrefs: ChapterHrefs;
  mindMap?: ChapterMindMap | null;
  renderLessonText: (text: string) => React.ReactNode;
}) {
  return (
    <ChapterScreenProvider value={{ actions, ask, chapter, hrefs }}>
      <ChapterBody mindMap={mindMap} renderLessonText={renderLessonText} />
    </ChapterScreenProvider>
  );
}
