"use client";

import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { type BuddyGlasses } from "@zoonk/utils/buddy";
import { GlassesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toBeltColor, useBeltName } from "../_utils/use-belt-name";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { useLearnAnalytics } from "../learn-context";
import { type CeremonyMilestone, toBuddyGlasses, useCeremonyCopy } from "./use-ceremony-copy";

export type { CeremonyMilestone } from "./use-ceremony-copy";

type CeremonyProps = {
  /** Draws the buddy in its new belt, stage or glasses; null for learners who haven't picked one. */
  buddy: LearnBuddy | null;
  milestone: CeremonyMilestone;
  /** Called once it's closed, by its button, Skip or Escape. */
  onClose?: () => void;
  /** Records that it was celebrated, so it shows only once. Called when it appears. */
  onShown: (milestoneId: string) => void;
  /** New glasses can go on right away; without this, the ceremony only celebrates them. */
  onWearGlasses?: (glasses: BuddyGlasses) => Promise<boolean>;
};

/** How analytics names the milestones that get a moment. */
const CEREMONY_EVENTS = { belt: "belt", buddyStage: "buddy_stage", glasses: "glasses" } as const;

/**
 * Marks the milestone as shown once, so closing, skipping or reloading never repeats it, and
 * counts its moment (a badge has none).
 */
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

/** The picture: the buddy in its new belt, at its new stage or in its new glasses. */
function CeremonyArt({ buddy, milestone }: Pick<CeremonyProps, "buddy" | "milestone">) {
  const beltName = useBeltName();
  const buddyName = useBuddyName(buddy ?? { kind: "zu", name: null });
  const belt = toBeltColor(milestone.key);
  const glasses = toBuddyGlasses(milestone.key);

  if (buddy) {
    return (
      <Buddy
        beltColor={milestone.kind === "belt" && belt ? belt : buddy.beltColor}
        className="animate-in fade-in motion-safe:zoom-in-90 size-52 duration-500"
        energy={buddy.energy}
        expression="cheer"
        glasses={milestone.kind === "glasses" && glasses ? glasses : buddy.glasses}
        kind={buddy.kind}
        label={buddyName}
      />
    );
  }

  if (belt) {
    return <BeltIndicator className="size-24" color={belt} label={beltName(belt)} />;
  }

  return (
    <span className="bg-muted flex size-24 items-center justify-center rounded-full">
      <GlassesIcon aria-hidden="true" className="size-10" />
    </span>
  );
}

/** Phones keep the button within thumb reach; wider screens keep it under the text. */
function CeremonyBody({
  action,
  buddy,
  children,
  milestone,
  onConfirm,
}: Pick<CeremonyProps, "buddy" | "milestone"> & {
  action: string;
  children: React.ReactNode;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-8 sm:my-auto sm:flex-none">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <CeremonyArt buddy={buddy} milestone={milestone} />
        {children}
      </div>

      <Button autoFocus className="w-full" onClick={onConfirm} size="lg">
        {action}
      </Button>
    </div>
  );
}

function CeremonyText({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <DialogTitle className="text-3xl leading-tight font-semibold tracking-tight text-balance">
        {title}
      </DialogTitle>
      <DialogDescription className="text-muted-foreground text-base text-balance">
        {detail}
      </DialogDescription>
    </div>
  );
}

/**
 * One full-screen moment for a new belt, the buddy's next stage or new glasses, over the summary:
 * the picture, a title, one line and one button, with Skip for anyone in a hurry. Escape closes it
 * too.
 */
function CeremonyMoment({
  buddy,
  milestone,
  onClose,
  onWearGlasses,
}: Omit<CeremonyProps, "onShown">) {
  const t = useExtracted();
  const [open, setOpen] = useState(true);
  const glasses = milestone.kind === "glasses" ? toBuddyGlasses(milestone.key) : null;
  const canWear = Boolean(glasses && buddy && onWearGlasses);
  const copy = useCeremonyCopy({ buddy, canWear, milestone });

  async function confirm() {
    if (canWear && glasses && onWearGlasses) {
      await onWearGlasses(glasses);
    }

    setOpen(false);
  }

  return (
    <Dialog
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          onClose?.();
        }
      }}
      open={open}
    >
      <DialogPortal>
        <DialogPopup
          className="data-open:animate-in data-open:fade-in data-closed:animate-out data-closed:fade-out fixed inset-0 z-50 flex flex-col overflow-y-auto duration-200"
          data-slot="milestone-ceremony"
        >
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)} size="sm" variant="ghost">
                {t("Skip")}
              </Button>
            </div>

            <CeremonyBody
              action={copy.action}
              buddy={buddy}
              milestone={milestone}
              onConfirm={() => void confirm()}
            >
              <CeremonyText detail={copy.detail} title={copy.title} />
            </CeremonyBody>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

/**
 * The session's one milestone, if it has one, as a full-screen moment over the end-of-session
 * summary; it marks itself as shown, so it never repeats. A badge is already on the checkpoint's
 * result and in the logbook, so it gets no second moment.
 */
export function MilestoneCeremony({ onShown, ...props }: CeremonyProps) {
  useMarkShown({ milestone: props.milestone, onShown });

  if (props.milestone.kind === "badge") {
    return null;
  }

  return <CeremonyMoment {...props} />;
}
