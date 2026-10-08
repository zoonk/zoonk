"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import {
  EllipsisIcon,
  FlagIcon,
  GraduationCapIcon,
  LibraryIcon,
  MessageCircleQuestionIcon,
  Share2Icon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useBuddyName } from "../buddies/use-buddy-name";
import { useContentFeedback } from "../feedback/feedback-context";
import { LearnLink } from "../learn-link";
import { type PlanTutor, usePlanScreen } from "../plan/plan-context";
import { useSharePlan } from "../plan/use-share-plan";
import { type GoalStatusChange, type GoalStatusControl, GoalStatusItems } from "./goal-actions";

/** "Report a problem" with the plan attached, in the feedback form's own words. */
function ReportItem() {
  const t = useExtracted("feedback");
  const feedback = useContentFeedback();
  const { plan } = usePlanScreen();

  if (!feedback) {
    return null;
  }

  return (
    <DropdownMenuItem
      onClick={() =>
        feedback.openFeedbackForm({
          context: { contentId: plan.planId, contentKind: "plan", screen: "plan" },
          isReport: true,
        })
      }
    >
      <FlagIcon aria-hidden="true" />
      {t("Report a problem")}
    </DropdownMenuItem>
  );
}

function TalkToBuddy({ buddy }: { buddy: NonNullable<PlanTutor["buddy"]> }) {
  const t = useExtracted();
  const name = useBuddyName(buddy);
  return t("Talk to {name}", { name });
}

/** "Talk to Zu": the buddy's conversation, where questions about the plan go. */
function AskTutorItem({ tutor }: { tutor: PlanTutor }) {
  const t = useExtracted();

  return (
    <DropdownMenuItem render={<LearnLink href={tutor.href} />}>
      <MessageCircleQuestionIcon aria-hidden="true" />
      {tutor.buddy ? <TalkToBuddy buddy={tutor.buddy} /> : t("Talk to your buddy")}
    </DropdownMenuItem>
  );
}

/** Pausing, resuming and archiving the goal, which the host may leave out. */
type JourneyMenuGoal = {
  control: GoalStatusControl;
  onArchive: () => void;
  onSetStatus: (status: GoalStatusChange) => void;
};

/** "Adjust plan" in the preparation card's action row, beside the Journey's "…". */
export function AdjustPlanButton({ onAdjust }: { onAdjust: () => void }) {
  const t = useExtracted();

  return (
    <Button onClick={onAdjust} variant="outline">
      <SlidersHorizontalIcon aria-hidden="true" />
      {t("Adjust plan")}
    </Button>
  );
}

/**
 * The Journey's "…": what the learner does now and then. Adjusting the plan comes first when the
 * page has no "Adjust plan" button of its own (`adjustInMenu`); then the exam's page (exam goals),
 * the course the plan is built from, sharing, talking to the buddy and reporting; last, what acts
 * on the goal itself (pause or resume, archive), here on its own page so it's clear which goal
 * changes.
 */
export function JourneyMenu({
  adjustInMenu,
  courseHref,
  examHref,
  goal,
  onAdjust,
}: {
  adjustInMenu: boolean;
  /** The Library course the plan takes part of, when it has a public page. */
  courseHref: string | null;
  examHref: string | null;
  goal: JourneyMenuGoal | null;
  onAdjust: () => void;
}) {
  const t = useExtracted();
  const share = useSharePlan();
  const { tutor } = usePlanScreen();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button className="rounded-full" size="icon" variant="outline" />}
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{t("Journey options")}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {adjustInMenu && (
          <DropdownMenuItem onClick={onAdjust}>
            <SlidersHorizontalIcon aria-hidden="true" />
            {t("Adjust plan")}
          </DropdownMenuItem>
        )}

        {examHref && (
          <DropdownMenuItem render={<LearnLink href={examHref} />}>
            <GraduationCapIcon aria-hidden="true" />
            {t("About the exam")}
          </DropdownMenuItem>
        )}

        {courseHref && (
          <DropdownMenuItem render={<LearnLink href={courseHref} />}>
            <LibraryIcon aria-hidden="true" />
            {t("See the full course")}
          </DropdownMenuItem>
        )}

        {(adjustInMenu || examHref || courseHref) && <DropdownMenuSeparator />}

        <DropdownMenuItem onClick={() => void share()}>
          <Share2Icon aria-hidden="true" />
          {t("Share the plan")}
        </DropdownMenuItem>

        {tutor && <AskTutorItem tutor={tutor} />}

        <ReportItem />

        {goal && (
          <>
            <DropdownMenuSeparator />
            <GoalStatusItems
              control={goal.control}
              onArchive={goal.onArchive}
              onSetStatus={goal.onSetStatus}
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
