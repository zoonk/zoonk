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

/** `startConversation` resolves to false when the call didn't start. */
type LanguageUnitActions = {
  startConversation: (minutes: number) => Promise<boolean>;
  startTestOut: () => Promise<TestOutStart>;
};

type LanguageUnitHrefs = {
  back: string;
  lesson: (lessonId: string) => string;
  pattern: (patternId: string) => string;
  pronunciation: string;
};

const PRACTICE_TITLE_ID = "unit-practice-title";
const PROGRESS_TITLE_ID = "unit-progress-title";
const EXTRAS_TITLE_ID = "unit-extras-title";

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

export function LanguageUnitScreen({
  actions,
  ask,
  hrefs,
  renderLessonText,
  unit,
  upNext = false,
}: {
  actions: LanguageUnitActions;
  ask?: React.ReactNode;
  hrefs: LanguageUnitHrefs;
  renderLessonText: (text: string) => React.ReactNode;
  unit: LanguageUnitView;
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
