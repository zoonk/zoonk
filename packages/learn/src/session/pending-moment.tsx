"use client";

import { useExtracted } from "next-intl";
import { TaskBody } from "../_components/task-layout";
import { type MomentKind, useMomentTitle } from "./use-moment-title";

/**
 * The block's moment while its work is being saved: its title already in place ("Lesson complete"),
 * where the moment puts it, and a quiet shimmering line for what it earned, which lands right under
 * it. The screen reads as done from the first frame, never as an empty page.
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
    <TaskBody data-slot="pending-moment">
      <div className="flex flex-col gap-2" role="status">
        <h2 className="text-title">{title}</h2>
        <p className="text-muted-foreground shimmer font-mono text-xs">
          {t("Saving your progress…")}
        </p>
      </div>
    </TaskBody>
  );
}
