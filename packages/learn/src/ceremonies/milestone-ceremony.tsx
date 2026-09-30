"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { type BuddyGlasses } from "@zoonk/utils/buddy";
import { AwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { useLearnAnalytics } from "../learn-context";
import { useExperienceMode } from "../mode-provider";
import { CeremonyArt } from "./ceremony-art";
import {
  type CeremonyMilestone,
  useCeremonyCopy,
  useFocusMilestoneCopy,
} from "./use-ceremony-copy";

export type { CeremonyMilestone } from "./use-ceremony-copy";

type CeremonyProps = {
  /** The learner's Brain Power now: "You reached 7,500 Brain Power". */
  brainPower: number | null;
  milestone: CeremonyMilestone;
  /** Records that it was celebrated, so it shows only once. Called when it appears. */
  onShown: (milestoneId: string) => void;
  /** New glasses can go on right away; without this, the ceremony only celebrates them. */
  onWearGlasses?: (glasses: BuddyGlasses) => Promise<boolean>;
  buddy: LearnBuddy | null;
};

const CEREMONY_EVENTS = { belt: "belt", buddyStage: "buddy_stage" } as const;

/** Marks the milestone as shown once, and counts the belt and growth ceremonies Fun plays. */
function useMarkShown({
  milestone,
  onShown,
  staged,
}: Pick<CeremonyProps, "milestone" | "onShown"> & { staged: boolean }) {
  const analytics = useLearnAnalytics();
  const marked = useRef<string | null>(null);

  useEffect(() => {
    if (marked.current === milestone.id) {
      return;
    }

    marked.current = milestone.id;
    onShown(milestone.id);

    if (staged && (milestone.kind === "belt" || milestone.kind === "buddyStage")) {
      analytics.track({
        name: "Ceremony Shown",
        properties: { ceremony: CEREMONY_EVENTS[milestone.kind] },
      });
    }
  }, [analytics, milestone.id, milestone.kind, onShown, staged]);
}

/** Focus: the same milestone as a badge that lands quietly in the summary, with no overlay. */
function FocusMilestone({ milestone, buddy }: Pick<CeremonyProps, "milestone" | "buddy">) {
  const copy = { ...useCeremonyCopy({ buddy, milestone }), ...useFocusMilestoneCopy(milestone) };

  return (
    <div
      className="border-border flex items-start gap-3 rounded-2xl border p-3"
      data-slot="milestone-badge"
      role="status"
    >
      <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
        <AwardIcon aria-hidden="true" className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{copy.title}</span>
        <span className="text-muted-foreground text-sm">{copy.detail}</span>
      </span>
    </div>
  );
}

function CeremonyText({ copy }: { copy: ReturnType<typeof useCeremonyCopy> }) {
  return (
    <div className="flex flex-col gap-2">
      <DialogTitle className="font-fun-display animate-fun-ceremony text-3xl font-bold text-balance">
        {copy.title}
      </DialogTitle>
      {copy.subtitle && (
        <p className="fun-holo-text font-fun-display text-lg font-semibold">{copy.subtitle}</p>
      )}
      <DialogDescription className="text-fun-fg2 text-balance">{copy.detail}</DialogDescription>
    </div>
  );
}

/**
 * Fun: a short full-screen ceremony for a new belt color, the buddy's next stage, new glasses or a
 * badge. It's always skippable, the Escape key closes it, and reduced motion gets a calm fade.
 */
function FunCeremony({
  brainPower,
  milestone,
  onWearGlasses,
  buddy,
}: Omit<CeremonyProps, "onShown">) {
  const t = useExtracted();
  const [open, setOpen] = useState(true);
  const copy = useCeremonyCopy({ brainPower, buddy, milestone });
  const glasses = milestone.kind === "glasses" ? copy.glasses : null;

  async function wear() {
    if (glasses && onWearGlasses) {
      await onWearGlasses(glasses);
    }

    setOpen(false);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogPortal>
        <DialogPopup
          className="fun-space fixed inset-0 z-50 flex flex-col overflow-y-auto"
          data-slot="milestone-ceremony"
        >
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-fun-fg2 text-xs font-semibold tracking-[0.2em] uppercase">
                {copy.eyebrow}
              </p>
              <Button onClick={() => setOpen(false)} size="sm" variant="ghost">
                {t("Skip")}
              </Button>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
              <CeremonyArt milestone={milestone} buddy={buddy} />
              <CeremonyText copy={copy} />
            </div>

            <div className="flex flex-col gap-2">
              <Button
                autoFocus
                className="w-full"
                onClick={() => void wear()}
                size="xl"
                variant="lime"
              >
                {glasses && !onWearGlasses ? t("Continue") : copy.action}
              </Button>
              {glasses && onWearGlasses && (
                <Button className="w-full" onClick={() => setOpen(false)} size="lg" variant="ghost">
                  {t("Not now")}
                </Button>
              )}
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

/**
 * The session's one milestone, if it has one: a ceremony in Fun, a quiet badge in Focus. Render
 * it in the end-of-session summary with the summary's `ceremony`; it marks itself as shown.
 */
export function MilestoneCeremony({ onShown, ...props }: CeremonyProps) {
  const mode = useExperienceMode();

  useMarkShown({ milestone: props.milestone, onShown, staged: mode === "fun" });

  return mode === "fun" ? <FunCeremony {...props} /> : <FocusMilestone {...props} />;
}
