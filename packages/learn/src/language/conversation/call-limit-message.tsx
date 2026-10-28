"use client";

import { useExtracted } from "next-intl";
import { type CallLimit, CallLimitNotice } from "../../_components/help-limit-notice";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { CallOffMessage } from "./conversation-parts";

/** Never says how much call time a plan has. */
export function CallLimitMessage({
  className,
  limit,
  title,
}: {
  className?: string;
  limit: CallLimit;
  title?: string;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  const titles = {
    day: t("No more calls today"),
    month: t("No more calls this month"),
    total: t("Calls need a free account"),
  };

  return (
    <CallOffMessage className={className} title={title ?? titles[limit.period]}>
      <CallLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />
    </CallOffMessage>
  );
}
