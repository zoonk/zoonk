"use client";

import {
  useOpenLanguageConversation,
  useStartLanguageConversation,
} from "@/lib/language/use-start-language-conversation";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { type ExamView } from "@zoonk/core/exams/view/contract";
import { type ExamActions, type ExamHrefs, ExamScreen } from "@zoonk/learn/exam";
import { MockEntryButton } from "@zoonk/learn/mock/entry";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { changePlanAction } from "../plan/journey-actions";
import { reportExamResultAction } from "./exam-actions";

export function ExamScreenClient({
  exam,
  mocks,
}: {
  exam: ExamView;
  mocks: MockOptionsView | null;
}) {
  const { goalId } = exam;
  const searchParams = useSearchParams();
  const startConversation = useStartLanguageConversation({ from: "exam" });
  const openConversation = useOpenLanguageConversation({ from: "exam" });

  const actions = useMemo<ExamActions>(
    () => ({
      report: (input) => reportExamResultAction(goalId, input, getLocalTimeZone()),
      setDate: async (targetDate) => {
        const outcome = await changePlanAction(goalId, [{ kind: "setTargetDate", targetDate }]);
        return outcome?.status === "applied";
      },
      startExamTask: (task) => openConversation({ goalId, kind: "examSpeaking", task }),
      startSpeakingMock: () => startConversation({ goalId, kind: "speakingMock" }),
    }),
    [goalId, openConversation, startConversation],
  );

  const hrefs: ExamHrefs = {
    back: "/plan",
    challenge: (planItemId) => `/challenge/${planItemId}`,
    examTask: (conversationId) => `/conversation/${conversationId}?from=exam`,
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
      openSpeakingTask={searchParams.get("task")}
    />
  );
}
