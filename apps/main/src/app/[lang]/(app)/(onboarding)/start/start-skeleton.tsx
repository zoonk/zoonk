"use client";

import { hasAccount } from "@/components/public/no-account-note";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import {
  StartEntrySkeleton,
  StartSentGoal,
  StartWaitSkeleton,
} from "@zoonk/learn/onboarding/skeletons";
import { getSentGoal } from "@zoonk/learn/onboarding/understanding-start";
import { useSearchParams } from "next/navigation";
import { DRAFT_PARAM } from "./start-params";

export function StartSkeleton() {
  const searchParams = useSearchParams();
  const learner = useLearnerSummary();
  const draftId = searchParams.get(DRAFT_PARAM);

  if (!draftId) {
    return <StartEntrySkeleton />;
  }

  const sent = getSentGoal(draftId);

  return sent?.pending ? (
    <StartSentGoal goal={sent.prompt} hasAccount={hasAccount(learner)} />
  ) : (
    <StartWaitSkeleton />
  );
}
