"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useStateLabel } from "../content/use-state-label";
import { FADING_OUTLINE, SkillStateIcon } from "./skill-state";

const STATES = ["new", "learning", "solid", "mastered"] as const;

/** What the map's shapes mean. Screen readers hear each skill's state on the skill itself. */
export function MapLegend() {
  const t = useExtracted();
  const stateLabel = useStateLabel();

  return (
    <ul
      aria-hidden="true"
      className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs"
    >
      {STATES.map((state) => (
        <li className="inline-flex items-center gap-1.5" key={state}>
          <SkillStateIcon className="size-3.5" state={state} />
          {stateLabel({ state })}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span className={cn("size-3.5 rounded-full border", FADING_OUTLINE)} />
        {t("Fading")}
      </li>
    </ul>
  );
}
