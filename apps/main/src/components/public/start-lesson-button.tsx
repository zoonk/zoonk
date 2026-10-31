"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { useRouter } from "@/i18n/navigation";
import { getLessonWritingHref } from "@/lib/lessons/lesson-writing-href";
import { askToWriteLesson } from "@/lib/lessons/lesson-writing-request";
import { ORIGIN_PARAM, withCatalogOrigin } from "@/lib/public/public-hrefs";
import { buttonVariants } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { START_FAILURE_SLOT, getStartControlClassName } from "./public-start";

/** Nothing is created before the tap, so crawlers following the page create nothing. */
function useLessonStart({ lessonId, origin }: { lessonId: string; origin: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [navigating, startTransition] = useTransition();
  const mounted = useRef(true);
  const opening = useRef(false);
  const pending = requesting || navigating;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const start = async () => {
    if (opening.current || pending) {
      return;
    }

    opening.current = true;
    setRequesting(true);

    try {
      setFailed(false);
      const openedFrom = globalThis.location.pathname + globalThis.location.search;
      const { data: answer } = await safeAsync(() => askToWriteLesson(lessonId));

      if (
        !mounted.current ||
        openedFrom !== globalThis.location.pathname + globalThis.location.search
      ) {
        return;
      }

      if (!answer || answer.status === "failed") {
        setFailed(true);
        return;
      }

      startTransition(() =>
        router.push(withCatalogOrigin(getLessonWritingHref({ answer, lessonId }), origin)),
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

      <CurrentPageLoginLink className={buttonVariants({ variant: "outline" })}>
        {t("Log in")}
      </CurrentPageLoginLink>
    </div>
  );
}

/** Without JavaScript it's a form that opens the player, which has its own start button. */
export function StartLessonButton({
  action,
  children,
  className,
  lessonId,
  origin,
}: {
  action: string;
  children: ReactNode;
  className?: string;
  lessonId: string;
  origin: string;
}) {
  const t = useExtracted();
  const { failed, pending, start } = useLessonStart({ lessonId, origin });

  return (
    <form
      action={action}
      className="flex flex-col gap-3 sm:items-start"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        void start();
      }}
    >
      <input name={ORIGIN_PARAM} type="hidden" value={origin} />

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
