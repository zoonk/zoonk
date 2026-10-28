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
} from "lucide-react";
import { useExtracted } from "next-intl";
import { useBuddyName } from "../buddies/use-buddy-name";
import { useContentFeedback } from "../feedback/feedback-context";
import { LearnLink } from "../learn-link";
import { type PlanTutor, usePlanScreen } from "../plan/plan-context";
import { useSharePlan } from "../plan/use-share-plan";
import { type GoalStatusChange, type GoalStatusControl, GoalStatusItems } from "./goal-actions";

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

function TalkToBuddy({ buddy }: { buddy: PlanTutor["buddy"] }) {
  const t = useExtracted();
  const name = useBuddyName(buddy);
  return t("Talk to {name}", { name });
}

function AskTutorItem({ tutor }: { tutor: PlanTutor }) {
  return (
    <DropdownMenuItem render={<LearnLink href={tutor.href} />}>
      <MessageCircleQuestionIcon aria-hidden="true" />
      <TalkToBuddy buddy={tutor.buddy} />
    </DropdownMenuItem>
  );
}

type JourneyMenuGoal = {
  control: GoalStatusControl;
  onArchive: () => void;
  onSetStatus: (status: GoalStatusChange) => void;
};

export function AdjustPlanButton({ onAdjust }: { onAdjust: () => void }) {
  const t = useExtracted();

  return (
    <Button onClick={onAdjust} size="sm" variant="outline">
      {t("Adjust plan")}
    </Button>
  );
}

export function JourneyMenu({
  courseHref,
  examHref,
  goal,
}: {
  courseHref: string | null;
  examHref: string | null;
  goal: JourneyMenuGoal | null;
}) {
  const t = useExtracted();
  const share = useSharePlan();
  const { tutor } = usePlanScreen();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button className="size-7.5" size="icon-sm" variant="outline" />}
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{t("Plan options")}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
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

        {(examHref || courseHref) && <DropdownMenuSeparator />}

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
