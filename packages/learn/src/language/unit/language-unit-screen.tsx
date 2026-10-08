"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { BookOpenTextIcon, LanguagesIcon, ListChecksIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DetailAside, DetailContent, DetailLayout } from "../../_components/detail-page";
import { Disclosure } from "../../_components/disclosure";
import { KindTile } from "../../_components/kind-tile";
import { LessonList } from "../../_components/lesson-list";
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

type UnitLesson = LanguageUnitView["lessons"][number];

const PRACTICE_TITLE_ID = "unit-practice-title";
const EXTRAS_TITLE_ID = "unit-extras-title";

function getLessonState({ isDone, isNext }: { isDone: boolean; isNext: boolean }) {
  if (isDone) {
    return "done" as const;
  }

  return isNext ? ("next" as const) : ("upcoming" as const);
}

/** The unit's lessons in order, the first not done being the one to open next. */
function toLessonStates(lessons: readonly UnitLesson[]) {
  const nextIndex = lessons.findIndex((lesson) => !lesson.done);

  return lessons.map((lesson, index) => ({
    lessonId: lesson.lessonId,
    minutes: lesson.minutes,
    state: getLessonState({ isDone: lesson.done, isNext: index === nextIndex }),
    title: lesson.title,
    written: lesson.written,
  }));
}

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
  const finished = unit.lessons.length > 0 && unit.lessons.every((lesson) => lesson.done);

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
        {!finished && unit.goalId && (
          <TestOutStartRow onStart={actions.startTestOut} scope="unit" />
        )}
        {unit.mistakes.length > 0 && (
          <Disclosure
            aside={unit.mistakes.length}
            icon={<KindTile kind="mistakes" />}
            title={t("Review my mistakes")}
          >
            <UnitMistakes mistakes={unit.mistakes} />
          </Disclosure>
        )}
        <UnitPracticeRows hrefs={hrefs} pattern={unit.pattern} pronunciation={unit.pronunciation} />
      </ListGroup>
    </PageSection>
  );
}

/**
 * A language unit's page, one real situation and the only page for it: its name and "Continue"
 * into the next lesson, then sections under their headers: its lessons in order, what the learner
 * will be able to do, practice (a conversation, a test to skip it, its open mistakes, a noticed
 * pattern, words to say again) and, folded away for reference, its grammar tips, words and
 * summaries.
 *
 * ```tsx
 * <LanguageUnitScreen
 *   actions={actions}
 *   hrefs={hrefs}
 *   renderLessonText={(text) => <LessonText text={text} />}
 *   unit={unit}
 * />
 * ```
 */
export function LanguageUnitScreen({
  actions,
  hrefs,
  renderLessonText,
  unit,
}: {
  actions: LanguageUnitActions;
  hrefs: LanguageUnitHrefs;
  /** Grammar tips and summaries are lesson text (emphasis, short lists): drawn as lessons do. */
  renderLessonText: (text: string) => React.ReactNode;
  unit: LanguageUnitView;
}) {
  return (
    <div className="flex flex-col gap-8" data-slot="language-unit">
      <UnitBar backHref={hrefs.back} view={unit} />

      <DetailLayout>
        <DetailAside>
          <UnitHeader lessonHref={hrefs.lesson} view={unit} />
        </DetailAside>

        <DetailContent>
          {unit.lessons.length > 0 && (
            <LessonList lessonHref={hrefs.lesson} lessons={toLessonStates(unit.lessons)} />
          )}
          <UnitObjectives view={unit} />
          <UnitPractice actions={actions} hrefs={hrefs} unit={unit} />
          <UnitExtras renderLessonText={renderLessonText} unit={unit} />
        </DetailContent>
      </DetailLayout>
    </div>
  );
}
