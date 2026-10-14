"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { BookOpenTextIcon, LanguagesIcon, ListChecksIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  DetailAside,
  DetailAsideSection,
  DetailContent,
  DetailLayout,
} from "../../_components/detail-page";
import { Disclosure } from "../../_components/disclosure";
import { KindDot } from "../../_components/kind-tile";
import { LessonList, LessonProgress } from "../../_components/lesson-list";
import { LessonSummaries } from "../../_components/lesson-summaries";
import { ListGroup, ListRowIcon } from "../../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../../_components/page";
import { type TestOutStart, TestOutStartRow } from "../../_components/test-out-start-link";
import { PracticeConversation } from "./practice-conversation";
import { UnitBar, UnitHeader } from "./unit-header";
import { UnitMistakes } from "./unit-mistakes";
import { UnitPracticeRows } from "./unit-rows";
import { UnitGrammarTips, UnitObjectives, UnitWords } from "./unit-sections";

/**
 * The host starts a practice call for the unit and opens it (false when it didn't start), and
 * asks for the unit's test-out and opens it.
 */
type LanguageUnitActions = {
  startConversation: (minutes: number) => Promise<boolean>;
  startTestOut: () => Promise<TestOutStart>;
};

/** Where the unit links: back, a lesson, a noticed pattern and the words to say again. */
type LanguageUnitHrefs = {
  back: string;
  lesson: (lessonId: string) => string;
  pattern: (patternId: string) => string;
  pronunciation: string;
};

const PRACTICE_TITLE_ID = "unit-practice-title";
const PROGRESS_TITLE_ID = "unit-progress-title";
const EXTRAS_TITLE_ID = "unit-extras-title";

/** The unit's folded extras: its grammar tips, its words and its summaries. */
function UnitExtras({
  renderLessonText,
  unit,
}: {
  renderLessonText: (text: string) => React.ReactNode;
  unit: LanguageUnitView;
}) {
  const t = useExtracted();
  const { grammarTips, summaries, words } = unit;

  if (grammarTips.length + words.count + summaries.length === 0) {
    return null;
  }

  return (
    <PageSection aria-labelledby={EXTRAS_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={EXTRAS_TITLE_ID}>{t("For reference")}</PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
        {grammarTips.length > 0 && (
          <Disclosure
            aside={grammarTips.length}
            icon={
              <ListRowIcon>
                <BookOpenTextIcon />
              </ListRowIcon>
            }
            title={t("Grammar tips")}
          >
            <UnitGrammarTips renderText={renderLessonText} tips={grammarTips} />
          </Disclosure>
        )}

        {words.count > 0 && (
          <Disclosure
            aside={words.count}
            icon={
              <ListRowIcon>
                <LanguagesIcon />
              </ListRowIcon>
            }
            title={t("Words in this unit")}
          >
            <UnitWords words={words} />
          </Disclosure>
        )}

        {summaries.length > 0 && (
          <Disclosure
            icon={
              <ListRowIcon>
                <ListChecksIcon />
              </ListRowIcon>
            }
            title={t("Unit summary")}
          >
            <LessonSummaries renderText={renderLessonText} summaries={summaries} />
          </Disclosure>
        )}
      </ListGroup>
    </PageSection>
  );
}

/**
 * The unit's practice: a conversation with its character, a test to skip it, its open mistakes
 * (folded), and the practice due in it (a noticed pattern, words to say again).
 */
function UnitPractice({
  actions,
  hrefs,
  unit,
}: {
  actions: LanguageUnitActions;
  hrefs: LanguageUnitHrefs;
  unit: LanguageUnitView;
}) {
  const t = useExtracted();

  return (
    <PageSection aria-labelledby={PRACTICE_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={PRACTICE_TITLE_ID}>{t("Practice")}</PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
        <PracticeConversation
          conversation={unit.conversation}
          onStart={actions.startConversation}
        />
        {unit.canTestOut && <TestOutStartRow onStart={actions.startTestOut} scope="unit" />}
        {unit.mistakes.length > 0 && (
          <Disclosure
            aside={unit.mistakes.length}
            icon={<KindDot kind="mistakes" />}
            title={t("Your mistakes")}
          >
            <UnitMistakes mistakes={unit.mistakes} />
          </Disclosure>
        )}
        <UnitPracticeRows hrefs={hrefs} pattern={unit.pattern} pronunciation={unit.pronunciation} />
      </ListGroup>
    </PageSection>
  );
}

/** How far the learner is in the unit, as one segment per lesson ("1 of 3"), in the aside. */
function UnitProgress({ unit }: { unit: LanguageUnitView }) {
  const t = useExtracted();
  const done = unit.lessons.filter((lesson) => lesson.done).length;

  if (unit.lessons.length === 0) {
    return null;
  }

  return (
    <DetailAsideSection
      className="hidden min-[72rem]:flex"
      detail={t("{done, number} of {total, number}", { done, total: unit.lessons.length })}
      title={t("Progress")}
      titleId={PROGRESS_TITLE_ID}
    >
      <LessonProgress lessons={unit.lessons} />
    </DetailAsideSection>
  );
}

/**
 * A language unit's page, one real situation and the only page for it, as a chapter's: its name
 * with "Continue" into the next lesson beside it, its lessons in order (the next one marked while
 * the unit is the plan's current one, `upNext`) and what the learner will be able to do; in the
 * aside from 72rem (after them under it) how far they are, practice (a conversation, a test to
 * skip it, its open mistakes, a noticed pattern, words to say again) and, for reference, its
 * grammar tips, words and summaries.
 *
 * ```tsx
 * <LanguageUnitScreen
 *   actions={actions}
 *   hrefs={hrefs}
 *   renderLessonText={(text) => <LessonText text={text} />}
 *   unit={unit}
 *   upNext
 * />
 * ```
 */
export function LanguageUnitScreen({
  actions,
  ask,
  hrefs,
  renderLessonText,
  unit,
  upNext = false,
}: {
  actions: LanguageUnitActions;
  /** "Ask" about the unit, such as the player's `AskTutor`; the host decides who can ask. */
  ask?: React.ReactNode;
  hrefs: LanguageUnitHrefs;
  /** Grammar tips and summaries are lesson text (emphasis, short lists): drawn as lessons do. */
  renderLessonText: (text: string) => React.ReactNode;
  unit: LanguageUnitView;
  /** The unit holds the plan's next lesson, which its list marks. */
  upNext?: boolean;
}) {
  const t = useExtracted();

  return (
    <DetailLayout
      aside={
        <>
          <UnitProgress unit={unit} />
          <UnitPractice actions={actions} hrefs={hrefs} unit={unit} />
          <UnitExtras renderLessonText={renderLessonText} unit={unit} />
        </>
      }
      asideLabel={t("About this unit")}
      bar={
        <UnitBar backHref={hrefs.back} view={unit}>
          {ask}
        </UnitBar>
      }
      data-slot="language-unit"
    >
      <DetailAside>
        <UnitHeader lessonHref={hrefs.lesson} view={unit} />
      </DetailAside>

      <DetailContent>
        {unit.lessons.length > 0 && (
          <LessonList lessonHref={hrefs.lesson} lessons={unit.lessons} upNext={upNext} />
        )}
        <UnitObjectives view={unit} />
      </DetailContent>
    </DetailLayout>
  );
}
