"use client";

import { useExtracted } from "next-intl";
import { type CallLimit, CallLimitNotice } from "../../_components/help-limit-notice";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { CallReason } from "./conversation-parts";

export function useCallLimitTitle(limit: CallLimit): string {
  const t = useExtracted();

  const titles = {
    day: t("No more calls today"),
    month: t("No more calls this month"),
    total: t("Calls need a free account"),
  };

  return titles[limit.period];
}

/** Never says how much call time a plan has. */
export function CallLimitReason({
  className,
  limit,
  role,
}: {
  className?: string;
  limit: CallLimit;
  role?: "alert";
}) {
  const routes = useLearnRoutes();

  return (
    <CallReason className={className} role={role} title={useCallLimitTitle(limit)}>
      <CallLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />
    </CallReason>
  );
}
