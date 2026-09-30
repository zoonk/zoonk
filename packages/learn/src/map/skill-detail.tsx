"use client";

import { type MapSkill } from "@zoonk/core/view-models/map/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useStateLabel } from "../content/use-state-label";
import { FADING_OUTLINE, SkillStateIcon } from "./skill-state";

/** What a tapped skill is about: its state, the idea in one sentence, and where to go from it. */
export function SkillDetail({ children, skill }: { children?: React.ReactNode; skill: MapSkill }) {
  const t = useExtracted();
  const stateLabel = useStateLabel();

  return (
    <section
      aria-label={skill.name}
      className="bg-muted/60 in-data-[mode=fun]:fun-glass flex flex-col gap-2 rounded-2xl p-4"
    >
      <h3 className="font-semibold">{skill.name}</h3>

      <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <SkillStateIcon state={skill.state} />
          {stateLabel(skill)}
        </span>
        {skill.fading && (
          <span className={cn("rounded-full border px-2 text-xs", FADING_OUTLINE)}>
            {t("Fading: a review brings it back")}
          </span>
        )}
      </p>

      {skill.description && <p className="text-sm">{skill.description}</p>}
      {children}
    </section>
  );
}
