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
  SuggestionOpen,
  SuggestionResult,
  SuggestionSaveError,
  SuggestionSummary,
  useMainActionVariant,
} from "../_components/suggestion";
import { useFormatDuration } from "../_utils/time-format";
import { useFocusTestTitle } from "../focus-test/use-focus-test-texts";
import { useTodayScreen } from "./today-context";

function FocusTestNotice({
  offer,
  onDismiss,
}: {
  offer: FocusTestOffer;
  onDismiss: (kept: FocusTestOffer | null) => void;
}) {
  const t = useExtracted();
  const mainVariant = useMainActionVariant();
  const { actions } = useTodayScreen();
  const title = useFocusTestTitle();
  const formatDuration = useFormatDuration();
  const [state, setState] = useState<"dismissed" | "failed" | null>(null);
  // Stays busy after the start is saved, until the test's page replaces this one.
  const [starting, setStarting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const busy = isPending || starting;
  const result = state === "dismissed" ? t("Noted. You can take the test from your plan.") : null;

  const start = () => {
    setStarting(true);

    startTransition(async () => {
      const { data: started } = await safeAsync(() => actions.startFocusTest());
      setStarting(Boolean(started));
      setState(started ? null : "failed");
    });
  };

  const dismiss = () => {
    onDismiss(offer);

    startTransition(async () => {
      const { data: saved } = await safeAsync(() => actions.dismissFocusTest());
      setState(saved ? "dismissed" : "failed");

      if (!saved) {
        onDismiss(null);
      }
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
              {t({
                description:
                  "One line on the Today page that suggests taking the Focus test: it shows which exam subjects need most study time.",
                message: "The Focus test shows what to study most.",
              })}
            </SuggestionSummary>
            <SuggestionOpen />
          </>
        )}
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{title(true)}</SuggestionHeader>

        {result ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <>
            <SuggestionDescription>
              {t({
                description:
                  "{time} is a duration with its unit, such as “15 min”: how long the Focus test takes. “Your time” is the study time the learner has before the exam.",
                message:
                  "Your time can't cover everything before your exam. In about {time}, the Focus test shows what to study most.",
                values: { time: formatDuration(offer.minutes) },
              })}
            </SuggestionDescription>

            <SuggestionActions>
              <SuggestionAction
                action={start}
                busy={starting}
                disabled={busy}
                variant={mainVariant}
              >
                {t("Start the test")}
              </SuggestionAction>

              <SuggestionAction action={dismiss} disabled={busy} variant="outline">
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
 * "Not now" refreshes Today, which then no longer carries the offer; the card stays to show what
 * the answer did. An offer gone for any other reason, such as a test taken since, is gone here too.
 */
export function TodayFocusTest() {
  const { today } = useTodayScreen();
  const [dismissed, setDismissed] = useState<FocusTestOffer | null>(null);
  const offer = today.focusTest ?? dismissed;

  return offer && <FocusTestNotice offer={offer} onDismiss={setDismissed} />;
}
