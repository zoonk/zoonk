"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { usePrimaryVariant } from "../_utils/fun-primary";
import { LearnLink } from "../learn-link";
import { ExtraTimeButton } from "../session/extra-time-button";
import { useTodayScreen } from "./today-context";
import { useSessionState } from "./use-today-copy";

/** What changed today, the day's one next step once it's done: Enter opens it. */
function SummaryLink() {
  const t = useExtracted();
  const primaryVariant = usePrimaryVariant();
  const { actions } = useTodayScreen();
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      className={cn(
        buttonVariants({ size: "lg", variant: primaryVariant }),
        "h-12 w-full rounded-full text-base",
      )}
      href={actions.summaryHref}
      prefetch={false}
      ref={ref}
    >
      {t("See what changed")}
    </LearnLink>
  );
}

/**
 * The day's blocks are done (or a guardian's limit was reached): a kind line, what changed, and
 * "10 more minutes" while it's offered. Extra time is capped and never passes the limit.
 */
export function TodayDayDone() {
  const t = useExtracted();
  const { actions, today } = useTodayScreen();
  const { done, limitReached } = useSessionState();
  const { extraTime } = today.session;

  return (
    <div className="flex flex-col gap-3" data-slot="today-day-done">
      <p className="text-center font-medium text-balance" role="status">
        {limitReached && !done
          ? t("That's today's study time. See you tomorrow!")
          : t("Today's session is done. Nice work!")}
      </p>

      {done && <SummaryLink />}

      {extraTime.available && !limitReached && (
        <ExtraTimeButton action={actions.addExtraTime} minutes={extraTime.minutes} />
      )}
    </div>
  );
}
