"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { safeAsync } from "@zoonk/utils/error";
import { settleWithin } from "@zoonk/utils/timeout";
import { useRef, useState } from "react";
import { usePlanScreen } from "./plan-context";
import { type PlanPreviewState, isSamePreviewPlan, resolvePlanPreview } from "./plan-preview-state";
import { createPreviewRequests } from "./preview-requests";

const PREVIEW_TIMEOUT_MS = 45_000;

/**
 * The same object while refreshes deliver an unchanged view, so a wait for a preview carries on
 * through them.
 */
export function usePreviewBase(): object {
  const { plan } = usePlanScreen();
  const [base, setBase] = useState<object>(plan);
  const changed = !isSamePreviewPlan({ current: plan, previous: base });

  if (changed) {
    setBase(plan);
  }

  return changed ? plan : base;
}

/** `requestPreview` resolves to `null` once the request is cancelled or replaced. */
export function usePlanPreview() {
  const { actions, plan } = usePlanScreen();
  const [preview, setPreview] = useState<PlanPreviewState>({ status: "idle" });
  const requests = useRef(createPreviewRequests());

  if (preview.status !== "idle" && !isSamePreviewPlan({ current: plan, previous: preview.plan })) {
    setPreview({ status: "idle" });
  }

  const requestPreview = (operations: LearnerPlanOperation[]) => {
    const request = { operations, plan, status: "loading" } as const;
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
      preview.status !== "idle" && !isSamePreviewPlan({ current: plan, previous: preview.plan })
        ? ({ status: "idle" } as const)
        : preview,
    requestPreview,
    setPreview: () => {
      requests.current.cancel();
      setPreview({ status: "idle" });
    },
  };
}
