"use client";

import { useExtracted } from "next-intl";
import {
  type CallLimit,
  CallLimitNotice,
  type CallNeed,
} from "../../_components/help-limit-notice";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { CallReason } from "./conversation-parts";

/** A start that needs a set length says it needs more than is left, which may not be none. */
export function useCallLimitTitle(limit: CallLimit, need: CallNeed = "any"): string {
  const t = useExtracted();

  const titles = {
    day: t("No more calls today"),
    rolling30Days: t("You've used your call time"),
    total: t("Calls need a free account"),
  };

  const needs = {
    mock: t("Not enough call time for this mock exam"),
    task: t("Not enough call time for this task"),
  };

  return need === "any" || limit.period === "total" ? titles[limit.period] : needs[need];
}

/** Never says how much call time a plan has. */
export function CallLimitReason({
  className,
  limit,
  need,
  role,
}: {
  className?: string;
  limit: CallLimit;
  need?: CallNeed;
  role?: "alert";
}) {
  const routes = useLearnRoutes();

  return (
    <CallReason className={className} role={role} title={useCallLimitTitle(limit, need)}>
      <CallLimitNotice limit={limit} linkComponent={LearnLink} need={need} routes={routes} />
    </CallReason>
  );
}
