"use client";

import { useRouter } from "@/i18n/navigation";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardTitle,
} from "@zoonk/learn/notice";
import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { ArrowRightLeftIcon, BellIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { switchGoal } from "../_components/switch-goal";

export type ReminderGoal = { id: string; title: string };

export function ReminderGoalNotice({ goal }: { goal: ReminderGoal }) {
  const t = useExtracted();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [isSwitching, startSwitching] = useTransition();

  const switchToGoal = () =>
    startSwitching(async () => {
      setFailed(false);
      const { data: switched } = await safeAsync(() => switchGoal(goal.id));

      if (switched) {
        router.replace("/today");
        return;
      }

      setFailed(true);
    });

  return (
    <NoticeCard data-slot="reminder-goal-notice">
      <BellIcon aria-hidden="true" />

      <NoticeCardContent>
        <NoticeCardTitle>
          {t("Your study reminder was for {goal}.", { goal: goal.title })}
        </NoticeCardTitle>

        <NoticeCardActions>
          <Button
            busy={isSwitching}
            icon={<ArrowRightLeftIcon aria-hidden="true" />}
            onClick={switchToGoal}
            size="sm"
            variant="outline"
          >
            {t("Switch to this goal")}
          </Button>
        </NoticeCardActions>

        {failed && (
          <p className="text-destructive-text mt-2 text-sm" role="alert">
            {t("We couldn't switch goals. Try again.")}
          </p>
        )}
      </NoticeCardContent>
    </NoticeCard>
  );
}
