"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { useRouter } from "@/i18n/navigation";
import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { TaskActionBar, TaskActions } from "@zoonk/learn/task-layout";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useReducer, useTransition } from "react";
import { LessonRouteFrame } from "./lesson-route-frame";

type GatePhase = "failed" | "opening" | "refreshing";

type GateAction = { hasSession: boolean; type: "opened" } | { type: "retry" };

function gateReducer(_phase: GatePhase, action: GateAction): GatePhase {
  if (action.type === "retry") {
    return "opening";
  }

  return action.hasSession ? "refreshing" : "failed";
}

function useOpenAsGuest() {
  const router = useRouter();
  const [phase, dispatch] = useReducer(gateReducer, "opening");
  const [isRefreshing, startTransition] = useTransition();

  const open = useEffectEvent(async () => {
    const hasSession = await ensureGuestSession();
    dispatch({ hasSession, type: "opened" });

    if (hasSession) {
      startTransition(() => router.refresh());
    }
  });

  useEffect(() => {
    if (phase === "opening") {
      void open();
    }
  }, [phase]);

  const failed = phase === "failed" || (phase === "refreshing" && !isRefreshing);

  return { failed, retry: () => dispatch({ type: "retry" }) };
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
  const { failed, retry } = useOpenAsGuest();

  return (
    <LessonRouteFrame
      exitHref={exitHref}
      footer={
        failed && (
          <TaskActionBar>
            <TaskActions>
              <CurrentPageLoginLink className={buttonVariants({ size: "xl", variant: "outline" })}>
                {t("Log in")}
              </CurrentPageLoginLink>
              <Button className="flex-1" onClick={retry} size="xl">
                {t("Try again")}
              </Button>
            </TaskActions>
          </TaskActionBar>
        )
      }
      lesson={lesson}
    >
      {failed ? (
        <p className="text-sm" role="alert">
          {t("We couldn't open the lesson. Try again, or log in to keep going.")}
        </p>
      ) : (
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
