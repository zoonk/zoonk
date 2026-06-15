import { type LearningGoalResult } from "@/data/courses/course-suggestions";
import { getSession } from "@zoonk/core/users/session/get";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { ShieldAlertIcon, SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";
import { LearningGoalNotification } from "./learning-goal-notification";
import { learningGoalNotificationAction } from "./learning-goal-notification-action";

type LearningGoalMessageState =
  | Extract<LearningGoalResult, { kind: "comingSoon" }>
  | Extract<LearningGoalResult, { kind: "unsafe" }>;

/**
 * Shows the explicit non-generation state for routed goals that should not
 * create reusable course suggestions yet. This keeps the learn page honest
 * while quick-learning, exam, and personalized modes are still being built.
 */
export async function LearningGoalMessage({ state }: { state: LearningGoalMessageState }) {
  const t = await getExtracted();

  if (state.kind === "unsafe") {
    return (
      <Empty className="w-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlertIcon aria-hidden="true" />
          </EmptyMedia>

          <EmptyTitle>{t("You can't learn this on Zoonk")}</EmptyTitle>

          <EmptyDescription>
            {t(
              "Zoonk can't help with unsafe, illegal, or harmful goals. This violates our terms of use and may lead to account suspension.",
            )}
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Link className={buttonVariants({ size: "sm", variant: "outline" })} href="/learn">
            {t("Change goal")}
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  const notificationAction = learningGoalNotificationAction.bind(null, {
    goal: state.goal,
    prompt: state.prompt,
  });

  const session = await getSession();

  return (
    <Empty className="w-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon aria-hidden="true" />
        </EmptyMedia>

        <EmptyTitle>{t("Coming soon")}</EmptyTitle>

        <EmptyDescription>
          {t("Soon you'll be able to reach this goal with Zoonk.")}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <LearningGoalNotification action={notificationAction} defaultEmail={session?.user.email} />

        <Link className={buttonVariants({ size: "sm", variant: "outline" })} href="/learn">
          {t("Change goal")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
