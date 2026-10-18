"use client";

import { useRouter } from "@/i18n/navigation";
import { type PlanWatch } from "@zoonk/core/plans/changed-since-contract";
import { hasPlanChangedAction } from "./plan-changes-action";

/**
 * What a tab waiting on lessons does every few seconds (its `refresh` while they're written): it
 * asks whether what the page watches (`watch`: the goal's plan, or today's session too) or their
 * lessons changed since the page was read (`readAt`) and reads the page again only then, or only
 * its view (`refresh`) when the page keeps one (Today). Asking costs a few small queries, where
 * reading the Plan or Today costs a couple hundred.
 */
export function useRefreshOnPlanChange({
  goalId,
  readAt,
  refresh,
  revision,
  watch,
}: {
  goalId: string;
  readAt: number;
  refresh?: () => void;
  /** The learner revision the page read (`getReadStamp`): any other change of theirs counts too. */
  revision?: string | null;
  watch: PlanWatch;
}) {
  const router = useRouter();

  return async () => {
    if (await hasPlanChangedAction({ goalId, revision, since: readAt, watch })) {
      if (refresh) {
        refresh();
      } else {
        router.refresh();
      }
    }
  };
}
