"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { useRouter } from "@/i18n/navigation";
import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { useGoalLimitMessage } from "@zoonk/learn/onboarding/goal-errors";
import { TaskActionBar, TaskActions } from "@zoonk/learn/task-layout";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useReducer, useTransition } from "react";
import { LessonRouteFrame } from "./lesson-route-frame";

type GatePhase = "blocked" | "cancelled" | "failed" | "opening" | "refreshing";

type GateAction =
  | { guest: Awaited<ReturnType<typeof ensureGuestSession>>; type: "opened" }
  | { type: "retry" };

function gateReducer(_phase: GatePhase, action: GateAction): GatePhase {
  if (action.type === "retry") {
    return "opening";
  }

  if (action.guest === "blocked" || action.guest === "cancelled") {
    return action.guest;
  }

  return action.guest === "ready" ? "refreshing" : "failed";
}

function useOpenAsGuest() {
  const router = useRouter();
  const [phase, dispatch] = useReducer(gateReducer, "opening");
  const [isRefreshing, startTransition] = useTransition();

  const open = useEffectEvent(async () => {
    const guest = await ensureGuestSession();
    dispatch({ guest, type: "opened" });

    if (guest === "ready") {
      startTransition(() => router.refresh());
    }
  });

  useEffect(() => {
    if (phase === "opening") {
      void open();
    }
  }, [phase]);

  const failed = phase === "failed" || (phase === "refreshing" && !isRefreshing);

  return {
    blocked: phase === "blocked",
    cancelled: phase === "cancelled",
    failed,
    retry: () => dispatch({ type: "retry" }),
  };
}

/** A lesson's screens load only with a session, so they can't be scraped from the page. */
export function LessonGuestGate({
  exitHref,
  lesson,
}: {
  exitHref: string;
  lesson: { description: string; title: string };
}) {
  const t = useExtracted();
  const limitMessage = useGoalLimitMessage();
  const { blocked, cancelled, failed, retry } = useOpenAsGuest();
  const canRetry = failed || cancelled;

  return (
    <LessonRouteFrame
      exitHref={exitHref}
      footer={
        (blocked || canRetry) && (
          <TaskActionBar>
            <TaskActions>
              <CurrentPageLoginLink
                className={cn(
                  buttonVariants({ size: "xl", variant: blocked ? "default" : "outline" }),
                  blocked && "flex-1",
                )}
              >
                {t("Log in")}
              </CurrentPageLoginLink>
              {canRetry && (
                <Button className="flex-1" onClick={retry} size="xl">
                  {failed ? t("Try again") : t("Start lesson")}
                </Button>
              )}
            </TaskActions>
          </TaskActionBar>
        )
      }
      lesson={lesson}
    >
      {blocked && (
        <p className="text-sm" role="alert">
          {limitMessage("browserBlocked")}
        </p>
      )}
      {failed && (
        <p className="text-sm" role="alert">
          {t("We couldn't open the lesson. Try again, or log in to keep going.")}
        </p>
      )}
      {!blocked && !canRetry && (
        <p
          aria-live="polite"
          className="text-muted-foreground flex items-center gap-2 text-sm"
          role="status"
        >
          <Spinner />
          {t("Opening your lesson")}
        </p>
      )}
    </LessonRouteFrame>
  );
}
