"use client";

import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { LearnPageBar } from "@zoonk/learn/bar";
import { useBuddyName } from "@zoonk/learn/buddy-name";

/** The buddy's name comes from the learner summary the frame already reads, so the page reads nothing more. */
export function EarlierQuestionsBar({ title }: { title: string }) {
  const learner = useLearnerSummary();
  const ready = learner.status === "ready";
  const name = useBuddyName(ready ? learner.summary.buddy : null);

  return <LearnPageBar back={{ href: "/buddy", label: ready ? name : undefined }} title={title} />;
}
