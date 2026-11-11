"use client";

import { type TodayFocusTest as FocusTestOffer } from "@zoonk/core/learner/placement/focus-test-contract";
import { safeAsync } from "@zoonk/utils/error";
import { CrosshairIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionContent,
  SuggestionDescription,
  SuggestionHeader,
  SuggestionLine,
  SuggestionLinkAction,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSaveError,
  SuggestionSummary,
} from "../_components/suggestion";
import { useCheckFocusLabel } from "../plan/plan-focus-test";
import { useTodayScreen } from "./today-context";

function FocusTestNotice({ offer }: { offer: FocusTestOffer }) {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const checkFocusLabel = useCheckFocusLabel();
  const [state, setState] = useState<"dismissed" | "failed" | null>(null);
  const [isPending, startTransition] = useTransition();
  const result = state === "dismissed" ? t("Noted. You can take the test from your plan.") : null;

  const dismiss = () => {
    startTransition(async () => {
      const { data: saved } = await safeAsync(() => actions.dismissFocusTest());
      setState(saved ? "dismissed" : "failed");
    });
  };

  return (
    <Suggestion answered={result !== null} label={t("Focus test")} mark={<CrosshairIcon />}>
      <SuggestionLine>
        {result ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <>
            <SuggestionSummary>
              {t("A quick test can suggest where your study time should go.")}
            </SuggestionSummary>
            <SuggestionOpen />
          </>
        )}
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{t("Find where your study time should go")}</SuggestionHeader>

        {result ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <>
            <SuggestionDescription>
              {t(
                "Your study time can't cover everything before your exam. Quick questions on your subjects suggest where to focus.",
              )}
            </SuggestionDescription>

            <SuggestionActions>
              <SuggestionLinkAction href={actions.focusTestHref}>
                {checkFocusLabel(offer.minutes)}
              </SuggestionLinkAction>

              <SuggestionAction action={dismiss} disabled={isPending} variant="outline">
                {t("Not now")}
              </SuggestionAction>
            </SuggestionActions>
          </>
        )}

        {state === "failed" && <SuggestionSaveError />}
      </SuggestionContent>
    </Suggestion>
  );
}

/**
 * Dismissing refreshes Today, which no longer carries the offer; the card stays until the learner
 * leaves, to show what the answer did.
 */
function useShownOffer(offer: FocusTestOffer | null): FocusTestOffer | null {
  const [shown, setShown] = useState(offer);

  if (offer && offer !== shown) {
    setShown(offer);
  }

  return offer ?? shown;
}

export function TodayFocusTest() {
  const { today } = useTodayScreen();
  const offer = useShownOffer(today.focusTest);

  return offer && <FocusTestNotice offer={offer} />;
}
