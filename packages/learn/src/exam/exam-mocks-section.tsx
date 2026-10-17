"use client";

import { useExtracted } from "next-intl";
import { LIST_GROUP_CLASS } from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { PlusNotice } from "../_components/plus-lock";
import { MockSummaryRow } from "../mock/mock-summary-row";
import { useExamScreen } from "./exam-context";
import { ExamNextMock } from "./exam-next-mock";
import { ExamRunningMock } from "./exam-running-mock";

const MOCKS_TITLE_ID = "exam-mocks-section-title";

/** The mocks taken so far, newest last, each a row of the mocks' list opening its result. */
function ExamMockRows() {
  const { exam, hrefs } = useExamScreen();

  return exam.mocks.map((mock) => (
    <li key={mock.finishedAt}>
      <MockSummaryRow href={mock.blockId ? hrefs.mock(mock.blockId) : null} mock={mock} />
    </li>
  ));
}

/**
 * The exam's mocks under one header with how many were taken: the ones the learner left running,
 * the first highlighted, with what's answered and the time left (the plan's next one is
 * highlighted when none runs), then the ones taken so far, in one list. Without Plus the mocks
 * show all the same, marked Plus, with the one notice of what Plus unlocks under them (taking one
 * any time is the page's main action, marked Plus too). How they went is the next section. The
 * section leaves itself out when it has nothing to show.
 */
export function ExamMocks({ offered }: { offered: boolean }) {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const locked = exam.mocksRequirePlus && (exam.nextMock !== null || offered);
  const running = exam.runningMocks.length > 0;

  if (!running && !exam.nextMock && exam.mocks.length === 0 && !locked) {
    return null;
  }

  return (
    <PageSection aria-labelledby={MOCKS_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={MOCKS_TITLE_ID}>{t("Mock exams")}</PageSectionTitle>
        {exam.mocks.length > 0 && (
          <PageSectionDetail>
            {t("{count, plural, one {# taken} other {# taken}}", { count: exam.mocks.length })}
          </PageSectionDetail>
        )}
      </PageSectionHeader>

      {(running || exam.nextMock || exam.mocks.length > 0) && (
        <ol aria-labelledby={MOCKS_TITLE_ID} className={LIST_GROUP_CLASS}>
          {exam.runningMocks.map((mock, index) => (
            <li aria-current={index === 0 ? "step" : undefined} key={mock.id}>
              <ExamRunningMock current={index === 0} running={mock} />
            </li>
          ))}
          {exam.nextMock && (
            <li aria-current={running ? undefined : "step"}>
              <ExamNextMock current={!running} />
            </li>
          )}
          <ExamMockRows />
        </ol>
      )}

      {locked && (
        <PlusNotice>
          {t(
            "Mock exams come with Plus: whenever you want, every week in your plan, and your progress over time.",
          )}
        </PlusNotice>
      )}
    </PageSection>
  );
}
