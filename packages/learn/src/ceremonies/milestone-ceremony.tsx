"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { type BuddyGlasses } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  TASK_MAIN_ACTION_CLASS,
  TaskActionBar,
  TaskActions,
  TaskBody,
} from "../_components/task-layout";
import { toBeltColor } from "../_utils/use-belt-name";
import { SCREEN_STEADY_MS, useSteady } from "../_utils/use-steady";
import { type LearnBuddy, resolveLearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { useLearnAnalytics } from "../learn-context";
import { type CeremonyMilestone, toBuddyGlasses, useCeremonyCopy } from "./use-ceremony-copy";

export type { CeremonyMilestone } from "./use-ceremony-copy";

type CeremonyProps = {
  /** Draws the buddy in its new belt, stage or glasses; null resolves to the default buddy. */
  buddy: LearnBuddy | null;
  milestone: CeremonyMilestone;
  /** Called once it's closed, by its button or Escape. */
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
function CeremonyArt({
  buddy: learnerBuddy,
  milestone,
}: Pick<CeremonyProps, "buddy" | "milestone">) {
  const buddy = resolveLearnBuddy(learnerBuddy);
  const buddyName = useBuddyName(buddy);
  const belt = toBeltColor(milestone.key);
  const glasses = toBuddyGlasses(milestone.key);

  return (
    <Buddy
      beltColor={milestone.kind === "belt" && belt ? belt : buddy.beltColor}
      // One pulse once it's in, for what just changed on it.
      className="motion-safe:animate-pulse-scale size-40 [animation-delay:200ms] sm:size-48"
      energy={buddy.energy}
      expression="cheer"
      glasses={milestone.kind === "glasses" && glasses ? glasses : buddy.glasses}
      kind={buddy.kind}
      label={buddyName}
    />
  );
}

function CeremonyText({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <DialogTitle className="text-title text-balance">{title}</DialogTitle>
      <DialogDescription className="text-muted-foreground text-balance">{detail}</DialogDescription>
    </div>
  );
}

/**
 * The moment's action in the pinned action bar, where every task's main action is: focused as it
 * opens, so Enter presses it. "Not now" beside it (`onDecline`) when the action changes something,
 * such as putting new glasses on.
 */
function CeremonyBar({
  action,
  onConfirm,
  onDecline,
}: {
  action: string;
  onConfirm: () => void;
  onDecline?: () => void;
}) {
  const t = useExtracted();

  return (
    <TaskActionBar>
      <TaskActions>
        {onDecline && (
          <Button className="shrink-0" onClick={onDecline} size="xl" variant="outline">
            {t("Not now")}
          </Button>
        )}

        <Button
          aria-keyshortcuts="Enter"
          autoFocus
          className={TASK_MAIN_ACTION_CLASS}
          onClick={onConfirm}
          size="xl"
        >
          {action}
          <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
        </Button>
      </TaskActions>
    </TaskActionBar>
  );
}

/**
 * One full-screen moment for a new belt, the buddy's next stage or new glasses, right after the
 * block that earned it or over the summary, laid out like a task's result: the picture, a title
 * and one line from the top of the column, and one button in the pinned action bar (focused, so
 * Enter presses it; a press still meant for the screen before it is ignored). Escape closes it too.
 */
function CeremonyMoment({
  buddy,
  milestone,
  onClose,
  onWearGlasses,
}: Omit<CeremonyProps, "onShown">) {
  const [open, setOpen] = useState(true);
  const glasses = milestone.kind === "glasses" ? toBuddyGlasses(milestone.key) : null;
  const canWear = Boolean(glasses && onWearGlasses);
  const copy = useCeremonyCopy({ buddy, canWear, milestone });
  const isSteady = useSteady(SCREEN_STEADY_MS);

  async function confirm() {
    if (!isSteady()) {
      return;
    }

    if (canWear && glasses && onWearGlasses) {
      await onWearGlasses(glasses);
    }

    setOpen(false);
  }

  function decline() {
    if (isSteady()) {
      setOpen(false);
    }
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
          {/* As far down as a task's result sits under its header. */}
          <TaskBody className="items-start pt-16 xl:pt-18">
            <CeremonyArt buddy={buddy} milestone={milestone} />
            <CeremonyText detail={copy.detail} title={copy.title} />
          </TaskBody>

          <CeremonyBar
            action={copy.action}
            onConfirm={() => void confirm()}
            onDecline={canWear ? decline : undefined}
          />
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

/**
 * The session's one milestone, if it has one, as a full-screen moment over the end-of-session
 * summary; it marks itself as shown, so it never repeats. A badge is already on the checkpoint's
 * result and in the logbook, so it gets no second moment: it closes as it's marked, and what waits
 * for it shows at once.
 */
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
