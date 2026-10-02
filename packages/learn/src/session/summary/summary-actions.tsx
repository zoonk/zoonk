"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { AwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { EnterButton } from "../../_components/enter-button";
import { useExperienceMode } from "../../mode-provider";
import { SavePlanNote } from "../../onboarding/save-plan-note";
import { ExtraTimeButton } from "../extra-time-button";
import { useSessionAction } from "../use-session-action";
import { useSessionSummary } from "./summary-context";

/**
 * Done goes back to Today; "10 more minutes" appears after the day's session while it's offered
 * (capped, and never past a guardian's limit). A guest is asked, softly, to save their plan. On
 * phones the actions sit at the bottom, within thumb reach; wider screens keep them under the
 * summary instead of across an empty gap.
 */
export function SummaryActions() {
  const t = useExtracted();
  const mode = useExperienceMode();
  const { actions, signUpHref, summary } = useSessionSummary();
  const { extraTime } = summary;
  const done = useSessionAction({ action: actions.done, enterKey: true });

  return (
    <div className="mt-auto flex flex-col gap-2 pt-4 sm:mt-0">
      {signUpHref && <SavePlanNote signUpHref={signUpHref} />}

      <EnterButton disabled={done.isPending} onClick={done.run}>
        {mode === "fun" ? t("Continue") : t("Done")}
      </EnterButton>

      {extraTime.available && (
        <ExtraTimeButton action={actions.addExtraTime} minutes={extraTime.minutes} />
      )}
    </div>
  );
}

/** At most one milestone per session: the host's ceremony, or a quiet line that lands softly. */
export function SummaryMilestone() {
  const t = useExtracted();
  const { ceremony, summary } = useSessionSummary();
  const milestone = summary.ceremony;

  if (!milestone) {
    return null;
  }

  if (ceremony) {
    return ceremony(milestone);
  }

  return (
    <p className="bg-muted/60 in-data-[mode=fun]:fun-glass flex items-start gap-2 rounded-2xl px-4 py-3 text-sm">
      <LineMarker>
        <AwardIcon aria-hidden="true" className="text-warning size-4" />
      </LineMarker>
      {t("New milestone reached. See it in Progress.")}
    </p>
  );
}
