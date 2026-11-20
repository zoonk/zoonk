"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { useRouter } from "@/i18n/navigation";
import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { getLessonWritingHref } from "@/lib/lessons/lesson-writing-href";
import { askToWriteLesson } from "@/lib/lessons/lesson-writing-request";
import { withOrigin } from "@/lib/public/public-hrefs";
import { answerHere, openingAsGuest } from "@/lib/session/tap-answer";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { LogInIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useRef, useState, useTransition } from "react";
import { START_FAILURE_SLOT, getStartControlClassName } from "./public-start";

/** Nothing is created before the tap, so crawlers following the page create nothing. */
function useLessonStart({ lessonId, origin }: { lessonId: string; origin: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [navigating, startTransition] = useTransition();
  const opening = useRef(false);
  const pending = requesting || navigating;

  const start = async () => {
    if (opening.current || pending) {
      return;
    }

    opening.current = true;
    setRequesting(true);

    try {
      setFailed(false);
      const signIn = ensureGuestSession();
      const asked = await answerHere(askToWriteLesson(lessonId), openingAsGuest(signIn));

      if (asked === "left") {
        return;
      }

      const answer = asked === "failed" ? null : asked.answer;

      if (!answer || answer.status === "failed") {
        setFailed(true);
        return;
      }

      startTransition(() =>
        router.push(withOrigin(getLessonWritingHref({ answer, lessonId }), origin)),
      );
    } finally {
      opening.current = false;
      setRequesting(false);
    }
  };

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

      <CurrentPageLoginLink
        className={buttonVariants({ variant: "outline" })}
        icon={<LogInIcon aria-hidden="true" />}
      >
        {t("Log in")}
      </CurrentPageLoginLink>
    </div>
  );
}

/** A form, so React keeps a press made before the page hydrates and starts the lesson once it does. */
export function StartLessonButton({
  children,
  className,
  lessonId,
  origin,
}: {
  children: ReactNode;
  className?: string;
  lessonId: string;
  origin: string;
}) {
  const t = useExtracted();
  const { failed, pending, start } = useLessonStart({ lessonId, origin });

  return (
    <form action={() => void start()} className="flex flex-col gap-3 sm:items-start">
      <Button
        busy={pending}
        className={getStartControlClassName(className)}
        size="lg"
        type="submit"
      >
        {children}
      </Button>

      {pending && (
        <span className="sr-only" role="status">
          {t("Opening your lesson")}
        </span>
      )}

      {failed && <StartFailure />}
    </form>
  );
}
