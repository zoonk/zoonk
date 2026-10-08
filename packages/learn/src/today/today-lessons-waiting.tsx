"use client";

import { Spinner } from "@zoonk/ui/components/spinner";
import { ClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { TodayCardStatus, TodayStatusTile } from "./today-card-status";
import { useTodayScreen } from "./today-context";

/**
 * A day whose lessons are still being written has no blocks yet: it says so, calmly, and fills in
 * on its own (Today reads itself again meanwhile), instead of claiming the day is done.
 */
export function TodayLessonsWaiting() {
  const t = useExtracted();
  const { writingStalled } = useTodayScreen();

  if (writingStalled) {
    return (
      <TodayCardStatus
        art={
          <TodayStatusTile className="bg-muted text-muted-foreground">
            <ClockIcon />
          </TodayStatusTile>
        }
        detail={t("Come back in a few minutes.")}
        title={t("Today's lessons are taking longer than usual")}
      />
    );
  }

  return (
    <TodayCardStatus
      art={
        <TodayStatusTile className="bg-muted text-muted-foreground">
          <Spinner />
        </TodayStatusTile>
      }
      detail={t("They show up here on their own.")}
      title={t("Getting today's lessons ready…")}
    />
  );
}
