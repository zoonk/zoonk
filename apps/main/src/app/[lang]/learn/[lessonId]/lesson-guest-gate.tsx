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

/**
 * Starts a guest session (an anonymous account behind BotID), then reloads the page, which now
 * sends the lesson's screens. If either step fails, or the reload still has no screens, the
 * visitor can try again.
 */
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

/**
 * A lesson's screens load only with a session, so they can't be scraped from the page. A visitor
 * (from a public lesson page or a shared link) becomes a guest here and the lesson opens; nothing
 * is lost, since signing up later keeps what they did. It's drawn in the lesson's own chrome, so
 * the way back (to the page it was opened from) is there while it opens and if it can't.
 */
export function LessonGuestGate({
  exitHref,
  lesson,
}: {
  /** Where leaving goes: the catalog page the lesson was opened from, or the home page. */
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
