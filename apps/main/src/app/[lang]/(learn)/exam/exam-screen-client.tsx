"use client";

import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { type ExamView } from "@zoonk/core/exams/view/contract";
import { type ExamActions, type ExamHrefs, ExamScreen } from "@zoonk/learn/exam";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import { reportExamResultAction } from "./exam-actions";

const HREFS: ExamHrefs = { mock: (blockId) => `/mock/${blockId}` };

/** The exam screen with main's actions for "How did it go?" and the IELTS speaking mock. */
export function ExamScreenClient({ exam }: { exam: ExamView }) {
  const { goalId } = exam;
  const startConversation = useStartLanguageConversation();

  const actions = useMemo<ExamActions>(
    () => ({
      report: (input) => reportExamResultAction(goalId, input, getLocalTimeZone()),
      startSpeakingMock: () => startConversation({ goalId, kind: "speakingMock" }),
    }),
    [goalId, startConversation],
  );

  return <ExamScreen actions={actions} exam={exam} hrefs={HREFS} />;
}
