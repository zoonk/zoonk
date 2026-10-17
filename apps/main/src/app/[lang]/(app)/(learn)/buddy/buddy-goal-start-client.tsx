"use client";

import { useRouter } from "@/i18n/navigation";
import { BuddyGoalStart, type BuddyStatusView } from "@zoonk/learn/buddy";
import { useSearchParams } from "next/navigation";

/**
 * A first goal opens onboarding with the learner's words filled in. Reading it waits for the
 * learner's confirmation there, and a search question stays a draft here too.
 */
export function BuddyGoalStartClient({
  hasEarlierQuestions,
  status,
}: {
  /** Whether the learner asked questions in an earlier version of their courses, to reread. */
  hasEarlierQuestions: boolean;
  status: BuddyStatusView;
}) {
  const router = useRouter();
  const draft = useSearchParams().get("ask") ?? "";

  return (
    <BuddyGoalStart
      draft={draft}
      earlierQuestionsHref={hasEarlierQuestions ? "/buddy/earlier-questions" : undefined}
      key={draft}
      onSend={(goal) => router.push(`/start?goal=${encodeURIComponent(goal)}`)}
      status={status}
    />
  );
}
