"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { TASK_OPTION_CLASS } from "../../_components/task-layout";
import { WritingWait } from "../../generation/writing-wait";
import { type CallStartOutcome, useCallStart } from "./use-call-start";

/** The next try is written when a call ends, so it usually opens at once; otherwise this waits for it. */
export function TryCallAgain({
  children,
  hint,
  kind,
  onTryAgain,
}: {
  children: ReactNode;
  hint: string;
  kind: "examSpeaking" | "speakingMock";
  onTryAgain: () => Promise<CallStartOutcome>;
}) {
  const t = useExtracted();
  const call = useCallStart({ onStart: onTryAgain });

  if (call.writing) {
    return <WritingWait hint={hint} kind={kind} writing={call.writing} />;
  }

  return (
    <>
      <Button
        className={TASK_OPTION_CLASS}
        disabled={call.isStarting}
        onClick={call.start}
        size="xl"
        variant="ghost"
      >
        {children}
      </Button>
      {call.failed && (
        <p className="text-destructive-text text-sm" role="alert">
          {t("The call didn't start. Try again in a moment.")}
        </p>
      )}
    </>
  );
}
