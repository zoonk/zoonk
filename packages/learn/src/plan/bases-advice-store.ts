"use client";

import { type PlanBasesAdvice } from "@zoonk/core/plans/bases-advice-contract";
import { useState } from "react";
import { requestWithin } from "./request-within";

type RecommendedBases = NonNullable<PlanBasesAdvice["recommended"]>;

type Asked = {
  recommended: RecommendedBases | null;
  revision: string;
  status: "answered" | "pending" | "unanswered";
};

export type BasesAdviceStore = { ask: () => void; recommended: RecommendedBases | null };

/**
 * The learner's tap that opens the prerequisites sheet asks. The server plans the whole goal to
 * answer, so a reopen while the plan is the same keeps the answer instead of asking again; one that
 * never came is asked for on the next opening.
 */
export function useBasesAdviceStore({
  advise,
  revision,
}: {
  advise: () => Promise<PlanBasesAdvice | null>;
  revision: string;
}): BasesAdviceStore {
  const [asked, setAsked] = useState<Asked | null>(null);
  const current = asked?.revision === revision ? asked : null;

  const ask = () => {
    if (current && current.status !== "unanswered") {
      return;
    }

    setAsked({ recommended: null, revision, status: "pending" });

    void requestWithin(advise).then((data) => {
      setAsked((now) =>
        now?.revision === revision && now.status === "pending"
          ? {
              recommended: data?.ready ? (data.recommended ?? null) : null,
              revision,
              status: data?.ready ? "answered" : "unanswered",
            }
          : now,
      );
    });
  };

  return { ask, recommended: current?.recommended ?? null };
}
