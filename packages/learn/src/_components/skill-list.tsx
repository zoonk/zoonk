"use client";

import { type MapSkill } from "@zoonk/core/view-models/map/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useStateLabel } from "../_utils/use-state-label";

/** A skill with its state: fading or in today's reviews puts it up for review. */
type ListedSkill = {
  dueToday?: boolean;
  fading: boolean;
  name: string;
  skillId: string;
  state: MapSkill["state"];
};

const STATE_DOT: Record<MapSkill["state"], string> = {
  learning: "bg-info",
  mastered: "bg-success",
  new: "bg-muted-foreground/40",
  solid: "bg-foreground",
};

/**
 * Each skill as one line: a dot for its state, its name and its state in words, so the dots need
 * no legend.
 */
export function SkillList({ skills }: { skills: readonly ListedSkill[] }) {
  const t = useExtracted();
  const stateLabel = useStateLabel();

  return (
    <ul className="flex flex-col">
      {skills.map((card) => (
        <li
          className="flex min-h-11 items-start gap-3 py-2 text-sm"
          data-state={card.state}
          key={card.skillId}
        >
          <span
            aria-hidden="true"
            className={cn("mt-1.5 size-2 shrink-0 rounded-full", STATE_DOT[card.state])}
          />
          <span className="min-w-0 flex-1">{card.name}</span>
          <span className="text-muted-foreground shrink-0 text-xs leading-5">
            {card.dueToday || card.fading ? (
              <span className="text-warning">{t("To review")}</span>
            ) : (
              stateLabel(card)
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
