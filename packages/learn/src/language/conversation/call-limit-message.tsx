"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type CallLimit, CallLimitNotice } from "../../_components/help-limit-notice";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { CallReason } from "./conversation-parts";

export function useCallLimitTitle(limit: CallLimit): string {
  const t = useExtracted();

  const titles = {
    day: t("No more calls today"),
    rolling30Days: t("You've used your call time"),
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

/** Beside the Start it answers, so it reads as the page's other inline limit notices do. */
function CallStartLimit({ className, limit }: { className?: string; limit: CallLimit }) {
  const routes = useLearnRoutes();

  return (
    <div className={className} role="alert">
      <CallLimitNotice
        limit={limit}
        linkComponent={LearnLink}
        routes={routes}
        title={useCallLimitTitle(limit)}
      />
    </div>
  );
}

/** Why a start didn't open: the cap that refused it, or `failed`, which names what didn't start. */
export function CallStartNote({
  call,
  className,
  failed,
}: {
  call: { failed: boolean; limit: CallLimit | null };
  className?: string;
  failed: string;
}) {
  if (call.limit) {
    return <CallStartLimit className={className} limit={call.limit} />;
  }

  return call.failed ? (
    <p className={cn("text-destructive-text text-sm", className)} role="alert">
      {failed}
    </p>
  ) : null;
}
