"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { safeAsync } from "@zoonk/utils/error";
import { settleWithin } from "@zoonk/utils/timeout";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePlanScreen } from "./plan-context";
import {
  type PlanPreviewState,
  type PreviewScope,
  isSamePreviewPlan,
  resolvePlanPreview,
} from "./plan-preview-state";
import { createPreviewRequests } from "./preview-requests";

const PREVIEW_TIMEOUT_MS = 45_000;

/**
 * The same object while refreshes deliver an unchanged view, so a wait for a preview carries on
 * through them.
 */
export function usePreviewBase(scope: PreviewScope = "plan") {
  const { plan } = usePlanScreen();
  const [base, setBase] = useState(plan);
  const changed = !isSamePreviewPlan({ current: plan, previous: base, scope });

  if (changed) {
    setBase(plan);
  }

  return changed ? plan : base;
}

/**
 * `requestPreview` resolves to `null` once the request is cancelled or replaced, or its screen goes
 * away.
 */
export function usePlanPreview(opening?: string) {
  const { actions, plan } = usePlanScreen();
  const scope = opening === "pastDate" || opening === "coverage" ? "advice" : "plan";
  const base = usePreviewBase(scope);
  const [preview, setPreview] = useState<PlanPreviewState>({ status: "idle" });
  const requests = useRef(createPreviewRequests(() => setPreview({ status: "idle" })));

  useLayoutEffect(() => {
    requests.current.showOpening(opening);
  }, [opening]);

  useLayoutEffect(() => {
    requests.current.showBase(base);
  }, [base]);

  useEffect(() => {
    const current = requests.current;
    return () => current.cancel();
  }, []);

  if (
    preview.status !== "idle" &&
    !isSamePreviewPlan({ current: plan, previous: preview.plan, scope })
  ) {
    setPreview({ status: "idle" });
  }

  const requestPreview = (operations: LearnerPlanOperation[]) => {
    const request = { operations, plan, scope, status: "loading" } as const;
    setPreview(request);

    return requests.current.run(request, async () => {
      const { data } = await safeAsync(() =>
        settleWithin({ ms: PREVIEW_TIMEOUT_MS, request: () => actions.preview(operations) }),
      );

      const result = data?.status === "settled" ? data.value : null;
      setPreview((current) => resolvePlanPreview({ current, preview: result, request }));

      return result;
    });
  };

  return {
    preview:
      preview.status !== "idle" &&
      !isSamePreviewPlan({ current: plan, previous: preview.plan, scope })
        ? ({ status: "idle" } as const)
        : preview,
    requestPreview,
    setPreview: () => requests.current.cancel(),
  };
}
