"use client";

import { Button } from "@zoonk/ui/components/button";
import { Textarea } from "@zoonk/ui/components/textarea";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { settleWithin } from "@zoonk/utils/timeout";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { HelpLimitNotice } from "../_components/help-limit-notice";
import { useLearnAnalytics, useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { type PlanEditOutcome, usePlanScreen } from "./plan-context";

/** The same limit the API applies to a plain-words edit. */
const MAX_EDIT_LENGTH = 500;

/**
 * A plain-words edit usually lands in a few seconds (a fast model, then the planner): past
 * `slowMs` the form says it's still on it, and past `timeoutMs` it stops waiting and offers retry.
 */
const EDIT_BOUNDS = { slowMs: 8000, timeoutMs: 45_000 } as const;

/** What the form says under its button: the edit's outcome, or that it stopped waiting for one. */
type ShownOutcome = PlanEditOutcome | { status: "timedOut" };

const FAILED: PlanEditOutcome = { status: "failed" };

function OutcomeMessage({ outcome }: { outcome: ShownOutcome | null }) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  if (!outcome) {
    return null;
  }

  if (outcome.status === "limitReached" || outcome.status === "slowDown") {
    return (
      <div role="status">
        <HelpLimitNotice limit={outcome} linkComponent={LearnLink} routes={routes} />
      </div>
    );
  }

  const messages: Record<typeof outcome.status, string> = {
    applied: t("Done. Your plan changed, and you can undo it above."),
    failed: t("That didn't work. Try again in a moment."),
    notUnderstood: t("We couldn't tell what to change. Try saying it another way."),
    proposed: t("This changes your end date, so it's waiting for your OK above."),
    timedOut: t("This took too long. If your plan doesn't change in a moment, try again."),
  };

  const isProblem = outcome.status === "failed" || outcome.status === "timedOut";

  return (
    <p
      className={isProblem ? "text-destructive text-sm" : "text-muted-foreground text-sm"}
      role="status"
    >
      {messages[outcome.status]}
    </p>
  );
}

/**
 * "Less on weekends", "focus on math": the learner says it and the plan changes the same way
 * its controls would. Bigger changes come back as a proposal to accept.
 */
export function PlanEditRequest({ textareaId }: { textareaId: string }) {
  const t = useExtracted();
  const { actions } = usePlanScreen();
  const analytics = useLearnAnalytics();
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<ShownOutcome | null>(null);
  // Its own state, not a transition's: a stuck request must not keep the form pending.
  const [isPending, setIsPending] = useState(false);
  const slow = useTakingLong({ active: isPending, afterMs: EDIT_BOUNDS.slowMs });

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = text.trim();

    if (!request) {
      return;
    }

    setIsPending(true);
    setOutcome(null);

    // Never an endless "Changing…": a request that fails or takes far too long says so.
    const settled = await settleWithin({
      ms: EDIT_BOUNDS.timeoutMs,
      request: () => actions.requestEdit(request),
    }).catch(() => ({ status: "settled" as const, value: FAILED }));

    setIsPending(false);

    if (settled.status === "timedOut") {
      setOutcome({ status: "timedOut" });
      return;
    }

    const result = settled.value;
    setOutcome(result);

    if (result.status === "applied" || result.status === "proposed") {
      setText("");

      analytics.track({
        name: "Plan Edited",
        properties: { change_kind: `words:${result.status}` },
      });
    }
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={(event) => void submit(event)}>
      <label className="text-sm font-medium" htmlFor={textareaId}>
        {t("Change it in your own words")}
      </label>
      <Textarea
        disabled={isPending}
        id={textareaId}
        maxLength={MAX_EDIT_LENGTH}
        onChange={(event) => setText(event.target.value)}
        placeholder={t("Less on weekends, more on math, skip what I know…")}
        rows={2}
        value={text}
      />
      <Button
        className="self-start"
        disabled={isPending || !text.trim()}
        focusableWhenDisabled
        type="submit"
      >
        {isPending ? t("Changing…") : t("Change my plan")}
      </Button>
      {slow && (
        <p className="text-muted-foreground text-sm" role="status">
          {t("Still changing your plan. This is taking longer than usual.")}
        </p>
      )}
      <OutcomeMessage outcome={outcome} />
    </form>
  );
}
