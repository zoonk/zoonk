"use client";

import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { GenerationFailureNotice } from "./generation-failure-notice";
import { type GenerationRun, hasStopped } from "./generation-run";

/**
 * A wait that's one model call: no steps or percentage to report, so it says what's coming and
 * spins until it's there. Once the run stops for good it reads as the failed screen, whose bar
 * holds the run's Try again; a lost connection keeps the wait with its Reconnect.
 */
export function IndeterminateWait({
  description,
  failedTitle,
  run,
  title,
}: {
  description: string;
  /** Said once the run stopped for good, so the title never claims work that isn't happening. */
  failedTitle: string;
  run: GenerationRun;
  title: string;
}) {
  const t = useExtracted();
  const stopped = hasStopped(run);

  return (
    <div className="flex flex-col gap-6" data-slot="indeterminate-wait">
      <div className="flex flex-col gap-3">
        {/* oxlint-disable-next-line jsx-a11y/heading-has-content -- The title's text is its children. */}
        <GenerationTimelineTitle render={<h1 />}>
          {stopped ? failedTitle : title}
        </GenerationTimelineTitle>
        <GenerationTimelineDescription>
          {stopped ? t("Nothing was lost. Try again in a moment.") : description}
        </GenerationTimelineDescription>
      </div>

      {!stopped && run.status === "failed" && (
        <GenerationFailureNotice barHasMainAction failure="connection" retry={run.retry} />
      )}

      {run.status !== "failed" && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <Spinner aria-hidden="true" className="size-5" role="presentation" />
          <span className="sr-only">{t("In progress")}</span>
        </p>
      )}
    </div>
  );
}
