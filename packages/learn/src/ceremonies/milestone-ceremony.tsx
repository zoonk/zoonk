"use client";

import { beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { BuddyActor } from "@zoonk/ui/components/buddy-actor";
import { Burst, type Spark } from "@zoonk/ui/components/burst";
import { DialogDescription, DialogTitle } from "@zoonk/ui/components/dialog";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { type BuddyGlasses } from "@zoonk/utils/buddy";
import { useEffect, useEffectEvent, useRef } from "react";
import { toBeltColor } from "../_utils/use-belt-name";
import { type LearnBuddy, resolveLearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { useLearnAnalytics } from "../learn-context";
import { useCeremonyClosing } from "./ceremony-closing";
import { CeremonyBar, CeremonyFrame, useCeremonyFrame } from "./ceremony-frame";
import { type CeremonyMilestone, toBuddyGlasses, useCeremonyCopy } from "./use-ceremony-copy";

export type { CeremonyMilestone } from "./use-ceremony-copy";

type CeremonyProps = {
  /** `null` draws the default buddy. */
  buddy: LearnBuddy | null;
  milestone: CeremonyMilestone;
  onClose?: () => void;
  onShown: (milestoneId: string) => void;
  onWearGlasses?: (glasses: BuddyGlasses) => Promise<boolean>;
};

const CEREMONY_EVENTS = { belt: "belt", buddyStage: "buddy_stage", glasses: "glasses" } as const;

function useMarkShown({ milestone, onShown }: Pick<CeremonyProps, "milestone" | "onShown">) {
  const analytics = useLearnAnalytics();
  const marked = useRef<string | null>(null);

  useEffect(() => {
    if (marked.current === milestone.id) {
      return;
    }

    marked.current = milestone.id;
    onShown(milestone.id);

    if (milestone.kind !== "badge") {
      analytics.track({
        name: "Ceremony Shown",
        properties: { ceremony: CEREMONY_EVENTS[milestone.kind] },
      });
    }
  }, [analytics, milestone.id, milestone.kind, onShown]);
}

/** White and Black would vanish behind the buddy, so they take the quiet fill. */
function stageClass(belt: BeltColor | null): string {
  if (!belt || belt === "white" || belt === "black") {
    return "bg-muted";
  }

  return cn(beltColorClasses[belt], "opacity-20 dark:opacity-25");
}

/** In px from the stage's middle. */
const STAGE_SPARKS: readonly Spark[] = [
  { size: 13, x: -128, y: -50 },
  { size: 10, x: -68, y: -118 },
  { size: 14, x: 18, y: -136 },
  { size: 10, x: 98, y: -96 },
  { size: 13, x: 136, y: -8 },
  { size: 10, x: 104, y: 82 },
  { size: 12, x: -12, y: 132 },
  { size: 10, x: -108, y: 84 },
];

function CeremonyArt({
  buddy: learnerBuddy,
  milestone,
}: Pick<CeremonyProps, "buddy" | "milestone">) {
  const buddy = resolveLearnBuddy(learnerBuddy);
  const buddyName = useBuddyName(buddy);
  const belt = toBeltColor(milestone.key);
  const glasses = toBuddyGlasses(milestone.key);

  return (
    <span
      className="relative flex size-56 shrink-0 items-center justify-center sm:size-64"
      data-slot="ceremony-stage"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 rounded-full",
          stageClass(milestone.kind === "belt" ? belt : null),
        )}
      />
      {milestone.kind !== "glasses" && (
        <Burst className="text-brain top-1/2 left-1/2" delayMs={BEAT_MS} sparks={STAGE_SPARKS} />
      )}
      <BuddyActor
        beltColor={milestone.kind === "belt" && belt ? belt : buddy.beltColor}
        className="relative size-40 sm:size-48"
        energy={buddy.energy}
        expression="happy"
        glasses={milestone.kind === "glasses" && glasses ? glasses : buddy.glasses}
        kind={buddy.kind}
        label={buddyName}
        reaction={{ act: milestone.kind === "glasses" ? "proud" : "cheer", delayMs: BEAT_MS }}
      />
    </span>
  );
}

function CeremonyText({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-2" data-slot="ceremony-text">
      <DialogTitle className="text-headline">{title}</DialogTitle>
      <DialogDescription className="text-muted-foreground text-base text-balance">
        {detail}
      </DialogDescription>
    </div>
  );
}

function CeremonyMoment({
  buddy,
  milestone,
  onClose,
  onWearGlasses,
}: Omit<CeremonyProps, "onShown">) {
  const glasses = milestone.kind === "glasses" ? toBuddyGlasses(milestone.key) : null;
  const canWear = Boolean(glasses && onWearGlasses);
  const copy = useCeremonyCopy({ buddy, canWear, milestone });
  const { close, open, whenSteady } = useCeremonyFrame(useCeremonyClosing());

  async function confirm() {
    if (canWear && glasses && onWearGlasses) {
      await onWearGlasses(glasses);
    }

    close();
  }

  return (
    <CeremonyFrame
      bar={
        <CeremonyBar
          action={copy.action}
          onConfirm={() => whenSteady(() => void confirm())}
          onDecline={canWear ? () => whenSteady(close) : undefined}
        />
      }
      onClose={close}
      onClosed={onClose}
      open={open}
      slot="milestone-ceremony"
    >
      <CeremonyArt buddy={buddy} milestone={milestone} />
      <CeremonyText detail={copy.detail} title={copy.title} />
    </CeremonyFrame>
  );
}

/** A badge already shows on the checkpoint's result and in the logbook, so it gets no moment. */
export function MilestoneCeremony({ onShown, ...props }: CeremonyProps) {
  useMarkShown({ milestone: props.milestone, onShown });
  const isBadge = props.milestone.kind === "badge";
  const close = useEffectEvent(() => props.onClose?.());

  useEffect(() => {
    if (isBadge) {
      close();
    }
  }, [isBadge]);

  if (isBadge) {
    return null;
  }

  return <CeremonyMoment {...props} />;
}
