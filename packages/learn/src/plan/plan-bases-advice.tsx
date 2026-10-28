"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { usePlanScreen } from "./plan-context";
import { PendingLabel } from "./plan-coverage";
import { type RecommendedBases, useAdviceText } from "./use-bases-texts";
import { requestWithin } from "./use-time-to-cover";

type AdviceState =
  | { status: "building" | "failed" | "idle" | "pending" }
  | { advice: RecommendedBases; status: "answered" };

/** Only when the learner asks, never for the page. Nothing is saved, so the plan isn't read again. */
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

  // Before paint and again a frame later: the sheet takes focus back from the page on its own after
  // the button gives way.
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
