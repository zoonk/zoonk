"use client";

import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { GenerationFailureNotice } from "./generation-failure-notice";
import { type GenerationRun } from "./generation-run";

/**
 * A wait that's one model call: no steps or percentage to report, so it says what's coming and
 * spins until it's there. A failure says so, with the run's own Try again.
 */
export function IndeterminateWait({
  barHasMainAction,
  description,
  failedTitle,
  run,
  title,
}: {
  barHasMainAction?: boolean;
  description: string;
  /** Said once the run stopped for good, so the title never claims work that isn't happening. */
  failedTitle: string;
  run: GenerationRun;
  title: string;
}) {
  const t = useExtracted();
  const failure = run.status === "failed" ? (run.failure ?? "generation") : null;
  const stopped = failure !== null && failure !== "connection";

  return (
    <div className="flex flex-col gap-6" data-slot="indeterminate-wait">
      <div className="flex flex-col gap-3">
        {/* oxlint-disable-next-line jsx-a11y/heading-has-content -- The title's text is its children. */}
        <GenerationTimelineTitle render={<h1 />}>
          {stopped ? failedTitle : title}
        </GenerationTimelineTitle>
        {!stopped && <GenerationTimelineDescription>{description}</GenerationTimelineDescription>}
      </div>

      {failure ? (
        <GenerationFailureNotice
          barHasMainAction={barHasMainAction}
          failure={failure}
          retry={run.retry}
        />
      ) : (
        <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <Spinner aria-hidden="true" className="size-5" role="presentation" />
          <span className="sr-only">{t("In progress")}</span>
        </p>
      )}
    </div>
  );
}
