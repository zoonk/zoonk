"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef } from "react";
import { TaskBody } from "../_components/task-layout";
import { LearnLink } from "../learn-link";
import { useSessionAction } from "./use-session-action";

export function OpenNextStep({
  exitHref,
  header,
  readNext,
  status,
}: {
  exitHref: string;
  header: React.ReactNode;
  /** Read-only: a remount must never start preparation or generation. */
  readNext: () => void;
  status: string;
}) {
  const t = useExtracted();

  const { failed, run } = useSessionAction({
    action: async () => {
      readNext();
      return true;
    },
  });

  const opened = useRef(false);
  const openNext = useEffectEvent(run);

  useEffect(() => {
    if (!opened.current) {
      opened.current = true;
      openNext();
    }
  }, []);

  return (
    <>
      {header}

      <TaskBody>
        {failed ? (
          <div className="flex flex-col items-start gap-3" role="alert">
            <p className="text-destructive-text text-sm">
              {t("We couldn't open the next step. Try again.")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={run} size="sm" variant="outline">
                {t("Try again")}
              </Button>
              <LearnLink
                className={buttonVariants({ size: "sm", variant: "ghost" })}
                href={exitHref}
              >
                {t("Back to Today")}
              </LearnLink>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
            <Spinner />
            {status}
          </p>
        )}
      </TaskBody>
    </>
  );
}
