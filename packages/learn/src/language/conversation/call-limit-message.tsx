"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type CallLimit, CallLimitNotice } from "../../_components/help-limit-notice";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";

/**
 * The plan's call time is used: until when, and the one thing to do about it (a free account for
 * a guest, Plus's higher call limits for a free learner). Never how much call time a plan has. The
 * call's screen and the sheet that picks a call's length say it the same way.
 */
export function CallLimitMessage({ className, limit }: { className?: string; limit: CallLimit }) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  const titles = {
    day: t("No more calls today"),
    month: t("No more calls this month"),
    total: t("Calls need a free account"),
  };

  return (
    <div
      className={cn("flex flex-col items-center gap-2 py-10 text-center", className)}
      role="alert"
    >
      <p className="text-lg font-semibold text-balance">{titles[limit.period]}</p>
      <CallLimitNotice
        className="items-center text-balance"
        limit={limit}
        linkComponent={LearnLink}
        routes={routes}
      />
    </div>
  );
}
