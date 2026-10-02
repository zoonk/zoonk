"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { type BuddyGlasses } from "@zoonk/utils/buddy";
import { CheckIcon, LockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { BuddyGlassesHowToEarn, BuddyGlassesName } from "./buddy-labels";
import { type LearnBuddy } from "./use-buddy-name";

type GlassesProgressView = {
  current: number;
  earned: boolean;
  glasses: BuddyGlasses;
  target: number;
};

/** "4/7 full meals", "38/50 capsules", or how a one-time pair is earned. */
function GlassesProgressLine({ progress }: { progress: GlassesProgressView }) {
  const t = useExtracted();
  const counts = { current: String(progress.current), target: String(progress.target) };

  switch (progress.glasses) {
    case "catEye":
      return t("{current}/{target} full meals", counts);
    case "retro":
      return t("{current}/{target} capsules", counts);
    case "aviator":
    case "monocle":
    case "round":
    case "star":
      return <BuddyGlassesHowToEarn glasses={progress.glasses} />;
    default:
      return <BuddyGlassesHowToEarn glasses={progress.glasses} />;
  }
}

function GlassesTile({
  isWearing,
  onWear,
  pending,
  buddy,
  progress,
}: {
  isWearing: boolean;
  onWear: () => void;
  pending: boolean;
  buddy: LearnBuddy;
  progress: GlassesProgressView;
}) {
  const t = useExtracted();
  const { earned } = progress;
  // The pair being worn, or any pair while one saves, stays focusable so keyboard focus stays put.
  const inert = isWearing || pending;

  return (
    <li>
      <button
        aria-disabled={(earned && inert) || undefined}
        aria-pressed={earned ? isWearing : undefined}
        className={cn(
          "fun-glass focus-visible:ring-ring/50 relative flex h-full min-h-28 w-full flex-col items-center gap-1 rounded-2xl p-2 pt-3 text-center outline-none focus-visible:ring-[3px] disabled:cursor-default aria-disabled:cursor-default",
          !earned && "border-dashed opacity-90",
          isWearing && "ring-fun-lime ring-2",
        )}
        disabled={!earned}
        onClick={inert ? undefined : onWear}
        type="button"
      >
        {earned ? (
          isWearing && (
            <CheckIcon
              aria-hidden="true"
              className="bg-fun-lime text-fun-lime-foreground absolute top-1.5 right-1.5 size-5 rounded-full p-0.5"
            />
          )
        ) : (
          <LockIcon aria-hidden="true" className="text-fun-fg2 absolute top-2 right-2 size-3.5" />
        )}
        <Buddy
          beltColor={buddy.beltColor}
          className={cn("size-12", !earned && "grayscale-[0.6]")}
          energy={buddy.energy}
          expression="happy"
          glasses={progress.glasses}
          kind={buddy.kind}
        />
        <span className="text-sm font-semibold">
          <BuddyGlassesName glasses={progress.glasses} />
        </span>
        <span
          className={cn(
            "text-xs",
            earned ? "text-fun-fg2" : "text-fun-accent-pink font-medium tabular-nums",
          )}
        >
          {isWearing ? t("wearing") : <GlassesProgressLine progress={progress} />}
        </span>
      </button>
    </li>
  );
}

/**
 * Every pair of glasses with how it's earned and how far along the learner is ("4/7"). Earned
 * pairs can be worn with one tap; nothing is random and nothing is sold.
 */
export function BuddyGlassesShelf({
  glasses,
  onWear,
  buddy,
}: {
  glasses: GlassesProgressView[];
  onWear: (glasses: BuddyGlasses) => Promise<boolean>;
  buddy: LearnBuddy;
}) {
  const t = useExtracted();
  const titleId = useId();
  const [wearing, setWearing] = useState(buddy.glasses);
  const [pending, setPending] = useState(false);
  const earned = glasses.filter((item) => item.earned).length;

  async function wear(next: BuddyGlasses) {
    const previous = wearing;
    setWearing(next);
    setPending(true);

    const saved = await onWear(next);

    setPending(false);

    if (!saved) {
      setWearing(previous);
    }
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-fun-display text-lg font-bold" id={titleId}>
          {t("Glasses")}
        </h2>
        <span className="text-fun-fg2 text-xs tabular-nums">
          {t("{earned} of {total}", { earned: String(earned), total: String(glasses.length) })}
        </span>
      </div>

      <ul className="grid grid-cols-3 gap-2">
        {glasses.map((progress) => (
          <GlassesTile
            isWearing={wearing === progress.glasses}
            key={progress.glasses}
            onWear={() => void wear(progress.glasses)}
            pending={pending}
            buddy={buddy}
            progress={progress}
          />
        ))}
      </ul>
    </section>
  );
}
