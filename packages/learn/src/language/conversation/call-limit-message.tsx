"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  type CallLimit,
  CallLimitNotice,
  useCallLimitLine,
  useLiveLimit,
} from "../../_components/help-limit-notice";
import { GateWords } from "../../_components/subscribe-gate";
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

/** The call cap's words alone, for a place that draws its way on where its action was. */
export function CallLimitWords({ limit }: { limit: CallLimit }) {
  return <GateWords title={useCallLimitTitle(limit)} {...useCallLimitLine(limit)} />;
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
  const title = useCallLimitTitle(limit);
  const opened = useLiveLimit(limit) === null;
  const notice = <CallLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />;

  // Once its day has come nothing ran out, so no title says it did.
  if (opened) {
    return (
      <div className={className} role={role}>
        {notice}
      </div>
    );
  }

  return (
    <CallReason className={className} role={role} title={title}>
      {notice}
    </CallReason>
  );
}

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
