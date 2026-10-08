"use client";

import { type ChapterMindMapView } from "@zoonk/core/mind-maps/contract";
import { type ChapterView } from "@zoonk/core/view-models/chapter/contract";
import { ListChecksIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DetailAside, DetailContent, DetailLayout } from "../_components/detail-page";
import { Disclosure } from "../_components/disclosure";
import { LessonList } from "../_components/lesson-list";
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

/** The chapter's mind map and what the host does for it; null for a language's unit. */
export type ChapterMindMap = { actions: MindMapActions; view: ChapterMindMapView };

const PRACTICE_TITLE_ID = "chapter-practice-title";
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

/** What the learner can do about the chapter besides its lessons: skip it with a test, fix its mistakes. */
function ChapterPractice() {
  const t = useExtracted();
  const { actions, chapter } = useChapterScreen();
  const canTestOut = chapter.chapter.state !== "done";

  if (!canTestOut && chapter.mistakes.open === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby={PRACTICE_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={PRACTICE_TITLE_ID}>{t("Practice")}</PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
        {canTestOut && <TestOutStartRow onStart={actions.startTestOut} scope="chapter" />}
        <ChapterMistakes />
      </ListGroup>
    </PageSection>
  );
}

function ChapterBody({
  mindMap,
  renderLessonText,
}: {
  mindMap: ChapterMindMap | null;
  renderLessonText: (text: string) => React.ReactNode;
}) {
  const { chapter, hrefs } = useChapterScreen();

  return (
    <div className="flex flex-col gap-8" data-slot="chapter">
      <ChapterBar />

      <DetailLayout>
        <DetailAside>
          <ChapterHeader />
        </DetailAside>

        <DetailContent>
          {chapter.lessons.length > 0 && (
            <LessonList
              lessonHref={(lessonId) => `${hrefs.lessonBasePath}/${lessonId}`}
              lessons={chapter.lessons}
            />
          )}
          <ChapterPractice />
          <ChapterSummary mindMap={mindMap} renderLessonText={renderLessonText} />
        </DetailContent>
      </DetailLayout>
    </div>
  );
}

/**
 * A chapter of the learner's plan: its number and lessons done, the next lesson first, the rest in
 * order, a test that skips a chapter the learner may already know, then folded away its skills
 * and the summaries its lessons left, and its mistakes when there are some.
 *
 * ```tsx
 * <ChapterScreen
 *   actions={{ practice, startTestOut }}
 *   chapter={chapter}
 *   hrefs={{ back: "/journey", lessonBasePath: "/learn" }}
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
