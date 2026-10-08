"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { buttonVariants } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { START_FAILURE_SLOT, getStartControlClassName } from "./public-start";

/**
 * Opens a lesson that isn't written yet from the visitor's tap: they become a guest first (behind
 * BotID; nothing is created before that tap, so crawlers following the page create nothing), then
 * the player asks for the lesson on open, as it does for anyone with a session, and follows the
 * writing. Pending lasts until the player shows.
 */
function useLessonStart(lessonId: string) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const start = () =>
    startTransition(async () => {
      setFailed(false);
      const { data: hasSession } = await safeAsync(ensureGuestSession);

      if (!hasSession) {
        setFailed(true);
        return;
      }

      router.push(`/learn/${lessonId}`);
    });

  return { failed, pending, start };
}

/** The start button above is the way to try again, so the failure only offers logging in. */
function StartFailure() {
  const t = useExtracted();

  return (
    <div
      className="flex max-w-md flex-col items-start gap-3"
      data-slot={START_FAILURE_SLOT}
      role="alert"
    >
      <p className="text-muted-foreground text-sm text-pretty">
        {t("We couldn't open the lesson. Try again, or log in to keep going.")}
      </p>

      <Link className={buttonVariants({ variant: "outline" })} href="/login" prefetch={false}>
        {t("Log in")}
      </Link>
    </div>
  );
}

/**
 * "Start this lesson" on the public page of a lesson that isn't written yet: one tap makes the
 * visitor a guest and opens the lesson being written. Without JavaScript it's a form that opens
 * the player, which has its own start button. Pending and failures show right here.
 */
export function StartLessonButton({
  action,
  children,
  className,
  lessonId,
}: {
  /** The player's path, for the form without JavaScript. */
  action: string;
  children: ReactNode;
  className?: string;
  lessonId: string;
}) {
  const t = useExtracted();
  const { failed, pending, start } = useLessonStart(lessonId);

  return (
    <form
      action={action}
      className="flex flex-col gap-3 sm:items-start"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        start();
      }}
    >
      <button className={getStartControlClassName(className)} disabled={pending} type="submit">
        {children}

        {pending ? (
          <Loader2Icon aria-hidden="true" className="animate-spin" data-icon="inline-end" />
        ) : (
          <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
        )}
      </button>

      {pending && (
        <span className="sr-only" role="status">
          {t("Opening your lesson")}
        </span>
      )}

      {failed && <StartFailure />}
    </form>
  );
}
