"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { LearnPageBar } from "@zoonk/learn/bar";
import { useBuddyName } from "@zoonk/learn/buddy-name";

/**
 * The page's bar, its way back named by the buddy it leads to ("‹ Zu / Earlier questions"), as the
 * buddy's tab is named: from the learner summary the frame already reads, so the page reads nothing
 * more for it. Until the summary arrives, the way back waits for its name.
 */
export function EarlierQuestionsBar({ title }: { title: string }) {
  const learner = useLearnerSummary();
  const ready = learner.status === "ready";
  const name = useBuddyName(ready ? learner.summary.buddy : null);

  return <LearnPageBar back={{ href: "/buddy", label: ready ? name : undefined }} title={title} />;
}
