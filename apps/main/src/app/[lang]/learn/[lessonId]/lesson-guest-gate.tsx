"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useReducer, useTransition } from "react";

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
 * is lost, since signing up later keeps what they did.
 */
export function LessonGuestGate({ lesson }: { lesson: { description: string; title: string } }) {
  const t = useExtracted();
  const { failed, retry } = useOpenAsGuest();

  return (
    <main className="bg-background flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
          <p className="text-muted-foreground">{lesson.description}</p>
        </header>

        {failed ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm" role="alert">
              {t("We couldn't open the lesson. Try again, or log in to keep going.")}
            </p>

            <div className="flex flex-wrap gap-3">
              <Button className="h-11 rounded-full" onClick={retry}>
                {t("Try again")}
              </Button>

              <Link
                className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full")}
                href="/login"
              >
                {t("Log in")}
              </Link>
            </div>
          </div>
        ) : (
          <p aria-live="polite" className="flex items-center gap-3" role="status">
            <Spinner className="size-5" />
            {t("Opening your lesson")}
          </p>
        )}
      </div>
    </main>
  );
}
