"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { usePlanScreen } from "./plan-context";
import { PendingLabel } from "./plan-coverage";
import { type RecommendedBases, useAdviceText } from "./use-bases-texts";
import { requestWithin } from "./use-time-to-cover";

/** Where asking for the recommendation stands (see `useBasesAdvice`). */
type AdviceState =
  | { status: "building" | "failed" | "idle" | "pending" }
  | { advice: RecommendedBases; status: "answered" };

/**
 * "Get a recommendation": the app plans the goal with every prerequisite in depth to say what it
 * recommends (see `PlanActions.adviseOnBases`), only when the learner asks, never for the page.
 * Nothing is saved, so the plan isn't read again.
 */
export function useBasesAdvice() {
  const { actions } = usePlanScreen();
  const [state, setState] = useState<AdviceState>({ status: "idle" });

  const ask = async () => {
    setState({ status: "pending" });
    const data = await requestWithin(() => actions.adviseOnBases());

    if (data?.ready && data.recommended) {
      setState({
        advice: { daysLeft: data.daysLeft, recommended: data.recommended },
        status: "answered",
      });

      return;
    }

    setState({ status: data ? "building" : "failed" });
  };

  return { ask, recommended: state.status === "answered" ? state.advice.recommended : null, state };
}

/**
 * Under the prerequisites' choice: "Get a recommendation" until the learner asks, its spinner while
 * the app works it out, then why it recommends the way the choice now marks, which one tap picks
 * (its preview then runs as for any choice), and that the plan already follows it when it does
 * (`followed`): a new plan starts on it, so asking right after often confirms what's picked. Once it answers, focus moves to the answer, since the
 * button that had it is gone; waiting and failing are said once, in their own status line. When it
 * couldn't be worked out, Try again takes the button's place, so focus stays on it.
 */
export function BasesAdvice({
  ask,
  followed,
  state,
}: {
  ask: () => void;
  followed: boolean;
  state: AdviceState;
}) {
  const t = useExtracted();
  const adviceText = useAdviceText();
  const answer = useRef<HTMLParagraphElement>(null);
  const pending = state.status === "pending";
  const retry = state.status === "failed" || state.status === "building";
  const answered = state.status === "answered";

  const retryText =
    state.status === "building"
      ? t("Your plan is still being built. Try again in a moment.")
      : t("We couldn't get a recommendation.");

  // Before the browser moves on: the button that asked gives way to the answer, and the sheet takes
  // focus back from the page on its own, again a frame later, over a focus moved after paint.
  useLayoutEffect(() => {
    if (answered) {
      answer.current?.focus();
    }
  }, [answered]);

  return (
    <div className="text-muted-foreground flex flex-col items-start gap-2 text-sm">
      <p aria-live="polite" className="sr-only">
        {pending && t("Getting a recommendation…")}
        {retry && retryText}
      </p>

      {state.status === "answered" && (
        <p className="text-pretty focus-visible:outline-none" ref={answer} tabIndex={-1}>
          {adviceText(state.advice)} {followed && t("Your plan already follows it.")}
        </p>
      )}

      {retry && (
        <p aria-hidden="true" className="text-pretty">
          {retryText}
        </p>
      )}

      {!answered && (
        <Button
          aria-busy={pending || undefined}
          disabled={pending}
          focusableWhenDisabled
          onClick={ask}
          size="sm"
          variant="outline"
        >
          <PendingLabel pending={pending}>
            {retry ? t("Try again") : t("Get a recommendation")}
          </PendingLabel>
        </Button>
      )}
    </div>
  );
}
