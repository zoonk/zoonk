"use client";

import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { BELT_COLORS_ORDER, type BeltColor } from "@zoonk/utils/belt-level";
import { type BuddyStage } from "@zoonk/utils/buddy";
import { LockIcon, SearchCheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { toBeltColor, useBeltName } from "../_utils/use-belt-name";
import { BUDDY_STAGES, BuddyStageName } from "../buddies/buddy-labels";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { type CeremonyMilestone, toBuddyGlasses, toBuddyStage } from "./use-ceremony-copy";

/** A belt of each stage, to draw the buddy as it was before it grew. */
const STAGE_BELT: Record<BuddyStage, BeltColor> = {
  adult: "blue",
  baby: "yellow",
  wise: "red",
  young: "orange",
};

function CeremonyBuddy({
  beltColor,
  className,
  buddy,
  withGlasses,
}: {
  beltColor: BeltColor;
  className?: string;
  buddy: LearnBuddy;
  withGlasses?: LearnBuddy["glasses"];
}) {
  const name = useBuddyName(buddy);

  return (
    <Buddy
      beltColor={beltColor}
      className={cn("animate-fun-ceremony size-48 sm:size-56", className)}
      energy={buddy.energy}
      expression="cheer"
      glasses={withGlasses ?? buddy.glasses}
      kind={buddy.kind}
      label={name}
    />
  );
}

/** The belt just earned between the one before and the next, which is still ahead. */
function BeltTrack({ color }: { color: BeltColor }) {
  const t = useExtracted();
  const beltName = useBeltName();
  const index = BELT_COLORS_ORDER.indexOf(color);

  const shown = [BELT_COLORS_ORDER[index - 1], color, BELT_COLORS_ORDER[index + 1]].filter(
    (belt) => belt !== undefined,
  );

  return (
    <ol className="flex items-start justify-center gap-4">
      {shown.map((belt) => {
        const isNew = belt === color;
        const isAhead = BELT_COLORS_ORDER.indexOf(belt) > index;

        return (
          <li
            className={cn(
              "flex flex-col items-center gap-1.5 text-xs",
              isNew ? "font-bold" : "text-fun-fg2",
            )}
            key={belt}
          >
            <span
              className={cn(
                "fun-glass relative flex size-12 items-center justify-center rounded-2xl",
                isNew && "ring-fun-accent-orange ring-2",
              )}
            >
              <BeltIndicator color={belt} label={beltName(belt)} size="lg" />
              {isAhead && (
                <LockIcon
                  aria-label={t("Still ahead")}
                  className="absolute -right-1 -bottom-1 size-3.5"
                  role="img"
                />
              )}
            </span>
            {beltName(belt)}
          </li>
        );
      })}
    </ol>
  );
}

function StageChips({ stage }: { stage: BuddyStage }) {
  const previous = BUDDY_STAGES[BUDDY_STAGES.indexOf(stage) - 1];

  return (
    <div className="flex items-center justify-center gap-2 text-xs">
      {previous && (
        <span className="fun-glass text-fun-fg2 rounded-full px-3 py-1">
          <BuddyStageName stage={previous} />
        </span>
      )}
      <span className="fun-inv rounded-full px-3 py-1 font-bold">
        <BuddyStageName stage={stage} />
      </span>
    </div>
  );
}

/** The picture for each kind of milestone: the buddy in its new belt, grown, or in new glasses. */
export function CeremonyArt({
  milestone,
  buddy,
}: {
  milestone: CeremonyMilestone;
  buddy: LearnBuddy | null;
}) {
  const belt = toBeltColor(milestone.key);
  const stage = toBuddyStage(milestone.key);
  const glasses = toBuddyGlasses(milestone.key);

  if (milestone.kind === "belt" && belt) {
    return (
      <div className="flex flex-col items-center gap-5">
        {buddy && <CeremonyBuddy beltColor={belt} buddy={buddy} />}
        <BeltTrack color={belt} />
      </div>
    );
  }

  if (milestone.kind === "buddyStage" && stage && buddy) {
    const previous = BUDDY_STAGES[BUDDY_STAGES.indexOf(stage) - 1];

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-end justify-center gap-2">
          {previous && (
            <Buddy
              beltColor={STAGE_BELT[previous]}
              className="size-20 opacity-50 grayscale"
              energy={buddy.energy}
              glasses={buddy.glasses}
              kind={buddy.kind}
            />
          )}
          <CeremonyBuddy beltColor={buddy.beltColor} className="size-52 sm:size-60" buddy={buddy} />
        </div>
        <StageChips stage={stage} />
      </div>
    );
  }

  if (milestone.kind === "glasses" && buddy) {
    return (
      <CeremonyBuddy
        beltColor={buddy.beltColor}
        buddy={buddy}
        withGlasses={glasses ?? buddy.glasses}
      />
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      <span className="fun-glass fun-holo-border animate-fun-ceremony flex size-32 items-center justify-center rounded-full">
        <SearchCheckIcon aria-hidden="true" className="text-fun-accent-cyan size-14" />
      </span>
      <Trickster className="absolute -right-10 -bottom-4 size-16 rotate-12 opacity-80" />
    </div>
  );
}
