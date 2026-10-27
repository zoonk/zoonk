"use client";

import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { EnterButton } from "../_components/enter-button";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type MomentKind, useMomentTitle } from "./use-moment-title";

/**
 * The block's moment while its work is being saved: its title already in place ("Lesson complete"),
 * where the moment puts it, a quiet shimmering line in the readouts' place, as far under the title
 * as they land, and Continue already in the bar, busy until the moment is ready. The screen reads
 * as done from the first frame, never as an empty page, and the title never moves.
 */
export function PendingMoment({
  kind,
  testedOut = false,
}: {
  kind: MomentKind;
  testedOut?: boolean;
}) {
  const t = useExtracted();
  const title = useMomentTitle({ kind, testedOut });

  return (
    <>
      <TaskBody data-slot="pending-moment">
        <div className="flex flex-col items-start gap-6" role="status">
          <h2 className="text-title">{title}</h2>
          <p className="text-muted-foreground shimmer text-sm">{t("Saving your progress…")}</p>
        </div>
      </TaskBody>

      <TaskActionBar>
        <TaskActions>
          <EnterButton disabled>
            <Spinner aria-hidden="true" />
            {t("Continue")}
          </EnterButton>
        </TaskActions>
      </TaskActionBar>
    </>
  );
}
