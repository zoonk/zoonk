"use client";

import { useRouter } from "@/i18n/navigation";
import { startWritingFromBrowser } from "@/lib/essays/writing-requests";
import {
  forgetWritingStartHandoff,
  readWritingStartHandoff,
} from "@/lib/essays/writing-start-handoff";
import { useStudyNavigation } from "@/lib/session/use-study-navigation";
import { type TomorrowTask } from "@zoonk/learn/writing";
import {
  WritingStartScreen,
  type WritingStartState,
  toWritingStartState,
} from "@zoonk/learn/writing/start";
import { useEffect } from "react";

const HREFS = { exit: "/today" };

const NO_TASK: TomorrowTask = { minutes: null, title: null };

/**
 * The block's question isn't admitted yet. The page's read says where it stands; the answer to the
 * learner's own tap, handed over in this tab, says more: it's being written, or a try failed.
 */
export function WritingStartClient({
  blockId,
  initial,
  sessionId,
  task,
}: {
  blockId: string;
  initial: WritingStartState;
  sessionId: string;
  task: TomorrowTask | null;
}) {
  const router = useRouter();
  const navigation = useStudyNavigation(sessionId);

  // Read on the first render only: the screen keeps its first state, and the handoff is gone after.
  const handed = readWritingStartHandoff(blockId);

  useEffect(() => forgetWritingStartHandoff(blockId), [blockId]);

  return (
    <WritingStartScreen
      finish={navigation.continueSession}
      hrefs={HREFS}
      initial={handed ? toWritingStartState(handed) : initial}
      onReady={() => router.refresh()}
      start={async () => {
        const answer = await startWritingFromBrowser({ blockId });
        return answer === "notWriting" ? { status: "failed" } : answer;
      }}
      task={task ?? NO_TASK}
    />
  );
}
