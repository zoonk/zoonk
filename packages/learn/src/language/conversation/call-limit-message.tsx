"use client";

import { useExtracted } from "next-intl";
import { type CallLimit, CallLimitNotice } from "../../_components/help-limit-notice";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { CallOffMessage, CallReason } from "./conversation-parts";

function useCallLimitTitle(limit: CallLimit): string {
  const t = useExtracted();

  const titles = {
    day: t("No more calls today"),
    month: t("No more calls this month"),
    total: t("Calls need a free account"),
  };

  return titles[limit.period];
}

function CallLimitBody({ limit }: { limit: CallLimit }) {
  const routes = useLearnRoutes();
  return <CallLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />;
}

/** Never says how much call time a plan has. */
export function CallLimitMessage({ className, limit }: { className?: string; limit: CallLimit }) {
  return (
    <CallOffMessage className={className} title={useCallLimitTitle(limit)}>
      <CallLimitBody limit={limit} />
    </CallOffMessage>
  );
}

export function CallLimitReason({ limit }: { limit: CallLimit }) {
  return (
    <CallReason title={useCallLimitTitle(limit)}>
      <CallLimitBody limit={limit} />
    </CallReason>
  );
}
