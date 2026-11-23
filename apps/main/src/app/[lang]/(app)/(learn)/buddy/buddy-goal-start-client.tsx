"use client";

import { useRouter } from "@/i18n/navigation";
import { BuddyGoalStart, type BuddyStatusView } from "@zoonk/learn/buddy";
import { useSearchParams } from "next/navigation";

/** Reading the goal waits for the learner's confirmation in onboarding. */
export function BuddyGoalStartClient({ status }: { status: BuddyStatusView }) {
  const router = useRouter();
  const draft = useSearchParams().get("ask") ?? "";

  return (
    <BuddyGoalStart
      draft={draft}
      key={draft}
      onSend={(goal) => router.push(`/start?goal=${encodeURIComponent(goal)}`)}
      status={status}
    />
  );
}
