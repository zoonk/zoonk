"use client";

import { useExtracted } from "next-intl";
import { type CallLimit, CallLimitNotice } from "../../_components/help-limit-notice";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { CallOffMessage } from "./conversation-parts";

/**
 * The plan's call time is used: until when, and the one thing to do about it (a free account for
 * a guest, Plus's higher call limits for a free learner). Never how much call time a plan has. The
 * call's screen and the sheet that picks a call's length say it the same way; a call that needs
 * more time than is left, while shorter ones still fit, passes its own `title`.
 */
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
