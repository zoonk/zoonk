"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef } from "react";
import { SessionBody } from "./session-body";
import { useSessionAction } from "./use-session-action";

/**
 * Opens the session's next step as soon as it shows, one tap fewer: the summary once the last
 * block is saved, or the block that still waits when the summary showed before it was there. Says
 * what it's doing meanwhile, and offers Try again when it didn't open.
 */
export function OpenNextStep({
  onOpen,
  status,
}: {
  onOpen: () => Promise<boolean>;
  status: string;
}) {
  const t = useExtracted();
  const { failed, run } = useSessionAction({ action: onOpen });
  const opened = useRef(false);
  const openNext = useEffectEvent(run);

  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      openNext();
    }
  }, []);

  if (failed) {
    return (
      <SessionBody>
        <div className="flex flex-col items-start gap-2" role="alert">
          <p className="text-destructive text-sm">
            {t("We couldn't open the next step. Try again.")}
          </p>
          <Button onClick={run} size="sm" variant="outline">
            {t("Try again")}
          </Button>
        </div>
      </SessionBody>
    );
  }

  return (
    <SessionBody className="items-center justify-center">
      <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
        <Spinner />
        {status}
      </p>
    </SessionBody>
  );
}
