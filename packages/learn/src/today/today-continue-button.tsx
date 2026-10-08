"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { type WaitState, useSlowWait } from "../_utils/use-slow-wait";
import { NEXT_TITLE_ID } from "./today-ids";
import { useContinueSession } from "./use-continue-session";
import { useSessionState } from "./use-today-copy";

/** What a slow tap is doing, under the button, so it never just greys out. */
function WaitLine({ wait }: { wait: WaitState }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-center text-sm" role="status">
      {wait === "slow" && t("Opening your next step…")}
      {wait === "verySlow" &&
        t("This is taking longer than usual. It opens on its own, no need to tap again.")}
    </p>
  );
}

/** Starts or continues the day from its button or Enter: it opens the next block. */
export function ContinueButton() {
  const t = useExtracted();
  const { started } = useSessionState();
  const { failed, isPending, run } = useContinueSession();
  const wait = useSlowWait(isPending);

  return (
    <div className="flex flex-col gap-2">
      <Button
        aria-describedby={NEXT_TITLE_ID}
        aria-keyshortcuts="Enter"
        className="h-12 w-full rounded-full text-base"
        disabled={isPending}
        focusableWhenDisabled
        onClick={run}
        size="lg"
      >
        {wait !== "none" && <Spinner aria-hidden="true" />}
        {started ? t("Continue") : t("Start")}
        <ShortcutKbd tone="inverse">Enter</ShortcutKbd>
      </Button>

      <WaitLine wait={wait} />

      {failed && (
        <p className="text-destructive text-center text-sm" role="alert">
          {t("We couldn't open the next step. Try again.")}
        </p>
      )}
    </div>
  );
}
