"use client";

import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { type ExamView } from "@zoonk/core/exams/view/contract";
import { type ExamActions, type ExamHrefs, ExamScreen } from "@zoonk/learn/exam";
import { MockEntryButton } from "@zoonk/learn/mock/entry";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import { reportExamResultAction } from "./exam-actions";

/**
 * The exam screen with main's actions for "How did it go?" and the IELTS speaking mock, and its
 * main action: taking a mock any time.
 */
export function ExamScreenClient({
  exam,
  mocks,
}: {
  exam: ExamView;
  mocks: MockOptionsView | null;
}) {
  const { goalId } = exam;
  const startConversation = useStartLanguageConversation();

  const actions = useMemo<ExamActions>(
    () => ({
      report: (input) => reportExamResultAction(goalId, input, getLocalTimeZone()),
      startSpeakingMock: () => startConversation({ goalId, kind: "speakingMock" }),
    }),
    [goalId, startConversation],
  );

  const hrefs: ExamHrefs = {
    back: "/journey",
    challenge: (planItemId) => `/challenge/${planItemId}`,
    mock: (blockId) => `/mock/${blockId}`,
  };

  return (
    <ExamScreen
      actions={actions}
      exam={exam}
      hrefs={hrefs}
      mockAction={
        mocks && (mocks.running || mocks.options.length > 0) ? (
          <MockEntryButton hrefs={MOCK_ENTRY_HREFS} view={mocks} />
        ) : null
      }
    />
  );
}
