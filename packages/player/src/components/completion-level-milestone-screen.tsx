"use client";

import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";
import { type PlayerCompletionMilestone } from "../completion-milestones";
import { type PlayerRoute } from "../player-context";
import { PlayerLink } from "../player-link";
import { useBeltColorLabel } from "../use-belt-color-label";
import { PrimaryKbd } from "./completion-action-link";
import { PlayerSupportingText } from "./player-supporting-text";
import { PlayerContentFrame } from "./step-layouts";

/**
 * Milestone screens use the same content frame as completion so the extra
 * screen feels like part of the player flow rather than a modal interruption.
 */
function CompletionMilestoneScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <PlayerContentFrame
      aria-live="polite"
      className={cn(
        "my-auto flex min-h-[60vh] flex-col items-center justify-center gap-8",
        className,
      )}
      data-slot="completion-milestone-screen"
      role="status"
      {...props}
    />
  );
}

/**
 * The visual mark gives the milestone a quiet focal point without adding a
 * celebratory illustration or a large progress widget to the completion flow.
 */
function CompletionMilestoneMark({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-center gap-4", className)}
      data-slot="completion-milestone-mark"
      {...props}
    >
      <span aria-hidden="true" className="bg-border h-px w-16" />
      {children}
      <span aria-hidden="true" className="bg-border h-px w-16" />
    </div>
  );
}

/**
 * Copy is grouped separately from the mark so future milestone kinds can reuse
 * the same screen shell with different wording and visual affordances.
 */
function CompletionMilestoneCopy({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex max-w-md flex-col items-center gap-3 text-center", className)}
      data-slot="completion-milestone-copy"
      {...props}
    />
  );
}

/**
 * The heading stays compact because this screen appears inside a lesson flow,
 * not on a standalone landing page.
 */
function CompletionMilestoneTitle({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-3xl font-semibold tracking-tight sm:text-4xl", className)}
      data-slot="completion-milestone-title"
      {...props}
    >
      {children}
    </h2>
  );
}

/**
 * Milestone actions need one obvious way back into the lesson-completion flow
 * plus an optional learning link for the level system.
 */
function CompletionMilestoneActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full max-w-sm flex-col gap-3", className)}
      data-slot="completion-milestone-actions"
      {...props}
    />
  );
}

/**
 * Renders the belt indicator for a level milestone without making the larger
 * screen know about the exact belt component classes.
 */
function BeltMilestoneIndicator({ color, colorLabel }: { color: BeltColor; colorLabel: string }) {
  const t = useExtracted();

  return (
    <CompletionMilestoneMark>
      <BeltIndicator
        className="animate-dot-pulse size-8 motion-reduce:animate-none"
        color={color}
        label={t("{color} belt", { color: colorLabel })}
        size="lg"
      />
    </CompletionMilestoneMark>
  );
}

/**
 * Achieved milestones explain why Brain Power matters at the moment the learner
 * sees the new belt state, keeping the celebration tied to knowledge growth.
 */
function AchievedLevelCopy({
  milestone,
}: {
  milestone: Extract<PlayerCompletionMilestone, { status: "achieved" }>;
}) {
  const t = useExtracted();
  const colorLabel = useBeltColorLabel(milestone.belt.color);

  return (
    <>
      <CompletionMilestoneTitle>{t("Brain Power up")}</CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t(
          "Your Brain Power is up. That means your knowledge is increasing, and you became a {color} belt, level {level}.",
          { color: colorLabel, level: String(milestone.belt.level) },
        )}
      </PlayerSupportingText>
    </>
  );
}

/**
 * Halfway milestones are progress nudges, so the copy emphasizes the remaining
 * lesson count and the next visible belt state instead of sounding complete.
 */
function HalfwayLevelCopy({
  milestone,
}: {
  milestone: Extract<PlayerCompletionMilestone, { status: "halfway" }>;
}) {
  const t = useExtracted();
  const colorLabel = useBeltColorLabel(milestone.targetBelt.color);

  return (
    <>
      <CompletionMilestoneTitle>{t("Halfway to your next level")}</CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t(
          "{count, plural, one {Complete # more lesson to reach {color} belt, level {level}.} other {Complete # more lessons to reach {color} belt, level {level}.}}",
          {
            color: colorLabel,
            count: milestone.remainingLessons,
            level: String(milestone.targetBelt.level),
          },
        )}
      </PlayerSupportingText>
    </>
  );
}

/**
 * Splits level milestone copy by status so adding another level status later
 * does not force conditional text into the top-level screen component.
 */
function LevelMilestoneCopy({ milestone }: { milestone: PlayerCompletionMilestone }) {
  if (milestone.status === "achieved") {
    return <AchievedLevelCopy milestone={milestone} />;
  }

  return <HalfwayLevelCopy milestone={milestone} />;
}

/**
 * Gives every level milestone a single target belt for its visual mark. The
 * achieved state uses the belt just reached; the halfway state uses the belt
 * the learner is now working toward.
 */
function getLevelMilestoneTarget(milestone: PlayerCompletionMilestone) {
  if (milestone.status === "achieved") {
    return milestone.belt;
  }

  return milestone.targetBelt;
}

/**
 * Renders the dedicated level milestone screen shown before the regular
 * completion summary when a completion crosses an important BP threshold.
 */
export function CompletionLevelMilestoneScreen({
  levelHref,
  milestone,
  onContinue,
}: {
  levelHref?: PlayerRoute;
  milestone: PlayerCompletionMilestone;
  onContinue: () => void;
}) {
  const t = useExtracted();
  const target = getLevelMilestoneTarget(milestone);
  const colorLabel = useBeltColorLabel(target.color);

  return (
    <CompletionMilestoneScreen>
      <BeltMilestoneIndicator color={target.color} colorLabel={colorLabel} />

      <CompletionMilestoneCopy>
        <LevelMilestoneCopy milestone={milestone} />
      </CompletionMilestoneCopy>

      <CompletionMilestoneActions>
        <Button className="w-full lg:justify-between" onClick={onContinue} size="lg">
          {t("Continue")}
          <PrimaryKbd>Enter</PrimaryKbd>
        </Button>

        {levelHref && (
          <PlayerLink
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            href={levelHref}
          >
            {t("Learn about levels")}
          </PlayerLink>
        )}
      </CompletionMilestoneActions>
    </CompletionMilestoneScreen>
  );
}
