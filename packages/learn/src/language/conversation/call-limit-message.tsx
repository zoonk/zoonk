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

/** What ran out, or once its day has come, that the call time is back. */
export function useCallLimitTitle(limit: CallLimit): string {
  const t = useExtracted();
  const opened = useLiveLimit(limit) === null;

  const titles = {
    day: t("No more calls today"),
    rolling30Days: t("You've used your call time"),
    total: t("Calls need a free account"),
  };

  return opened
    ? t({
        description:
          'The title over "You can try again now." once a call the learner\'s call time stopped can be made again.',
        message: "Your call time is back",
      })
    : titles[limit.period];
}

/** The call cap's words alone, for a place that draws its way on where its action was. */
export function CallLimitWords({ limit }: { limit: CallLimit }) {
  return <GateWords title={useCallLimitTitle(limit)} {...useCallLimitLine(limit)} />;
}

/** Never says how much call time a plan has. `untitled`: the screen's own title already says it. */
export function CallLimitReason({
  className,
  limit,
  role,
  untitled = false,
}: {
  className?: string;
  limit: CallLimit;
  role?: "alert";
  untitled?: boolean;
}) {
  const routes = useLearnRoutes();
  const title = useCallLimitTitle(limit);

  return (
    <CallReason className={className} role={role} title={untitled ? undefined : title}>
      <CallLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />
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
