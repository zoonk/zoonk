"use client";

import { useRouter } from "@/i18n/navigation";
import { type PlanWatch } from "@zoonk/core/plans/changed-since-contract";
import { hasPlanChangedAction } from "./plan-changes-action";

/** Asking what changed costs a few small queries, where reading the Plan or Today costs a couple hundred. */
export function useRefreshOnPlanChange({
  goalId,
  readAt,
  watch,
}: {
  goalId: string;
  readAt: number;
  watch: PlanWatch;
}) {
  const router = useRouter();

  return async () => {
    if (await hasPlanChangedAction({ goalId, since: readAt, watch })) {
      router.refresh();
    }
  };
}
