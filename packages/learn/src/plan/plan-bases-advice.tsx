"use client";

import { type PlanBasesView } from "@zoonk/core/plans/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { type BaseChoice } from "./plan-bases-group";
import { usePlanScreen } from "./plan-context";
import { PendingLabel } from "./plan-coverage";
import { type RecommendedBases, useAdviceText } from "./use-bases-texts";
import { requestWithin } from "./use-time-to-cover";

/** The learner's choices for the bases being chosen, by skill. */
type Choices = ReadonlyMap<string, BaseChoice>;

function followsRecommendation({
  bases,
  choices,
  recommended,
}: {
  bases: PlanBasesView;
  choices: Choices;
  recommended: BaseChoice;
}): boolean {
  return bases.items.every((item) => choices.get(item.skillId) === recommended);
}

/** Where asking for the recommendation stands (see `useBasesAdvice`). */
type AdviceState =
  | { status: "building" | "failed" | "idle" | "pending" }
  | { advice: RecommendedBases; status: "answered" };

/**
 * "Get a recommendation": the app plans the goal with every prerequisite in depth to say what it
 * recommends (see `PlanActions.adviseOnBases`), only when the learner asks, never for the page.
 * Nothing is saved, so the plan isn't read again.
 */
function useBasesAdvice() {
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

  return { ask, state };
}

/** Save choices, where the keyboard goes once the recommendation fills the choices in. */
export const BASES_SAVE_ID = "bases-save-choices";

/**
 * The box at the top of the sheet: "Get a recommendation" until the learner asks, its spinner while
 * the app works it out, then what it recommends, with "Use the recommendation" while the choices
 * differ from it, which fills them in (their preview then runs as for any choice) and moves the
 * keyboard on to Save choices. Once it answers, focus moves to that button, read with the advice,
 * or to the advice itself, since the button that had it is gone; waiting and failing are said once,
 * in their own status line. When it couldn't be worked out, Try again takes the button's place, so
 * focus stays on it.
 */
export function BasesAdvice({
  bases,
  choices,
  onUse,
}: {
  bases: PlanBasesView;
  choices: Choices;
  onUse: (recommended: BaseChoice) => void;
}) {
  const t = useExtracted();
  const adviceText = useAdviceText();
  const { ask, state } = useBasesAdvice();
  const answerId = useId();
  const answer = useRef<HTMLParagraphElement>(null);
  const use = useRef<HTMLButtonElement>(null);
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
      (use.current ?? answer.current)?.focus();
    }
  }, [answered]);

  const applyRecommendation = (recommended: BaseChoice) => {
    onUse(recommended);
    document.getElementById(BASES_SAVE_ID)?.focus();
  };

  return (
    <div className="bg-muted/60 flex flex-col items-start gap-2 rounded-xl p-4 text-sm">
      <p aria-live="polite" className="sr-only">
        {pending && t("Getting a recommendation…")}
        {retry && retryText}
      </p>

      {state.status === "answered" && (
        <>
          <p
            className="text-pretty focus-visible:outline-none"
            id={answerId}
            ref={answer}
            tabIndex={-1}
          >
            {adviceText(state.advice)}
          </p>

          {!followsRecommendation({ bases, choices, recommended: state.advice.recommended }) && (
            <Button
              aria-describedby={answerId}
              onClick={() => applyRecommendation(state.advice.recommended)}
              ref={use}
              size="sm"
              variant="secondary"
            >
              {t("Use the recommendation")}
            </Button>
          )}
        </>
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
          key="ask"
          onClick={() => void ask()}
          size="sm"
          variant="secondary"
        >
          <PendingLabel pending={pending}>
            {retry ? t("Try again") : t("Get a recommendation")}
          </PendingLabel>
        </Button>
      )}
    </div>
  );
}
