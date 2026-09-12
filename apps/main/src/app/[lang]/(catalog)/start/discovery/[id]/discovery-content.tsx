"use client";

import { Link } from "@/i18n/navigation";
import { runClientAction } from "@/lib/client-action";
import { type getCurrentUserCourseDiscovery } from "@zoonk/core/courses/discovery";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted, useLocale } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { readDiscovery, retryDiscovery, startDiscovery } from "./discovery-actions";
import { DiscoveryAnswers } from "./discovery-answers";
import { DiscoveryFeedback } from "./discovery-feedback";
import { DiscoveryQuestion } from "./discovery-question";

type Discovery = Extract<
  Awaited<ReturnType<typeof getCurrentUserCourseDiscovery>>,
  { status: "ready" }
>["discovery"];

const DISCOVERY_POLL_DELAY = 3000;

export function DiscoveryContent({ initialDiscovery }: { initialDiscovery: Discovery }) {
  const t = useExtracted();
  const language = useLocale();
  const [discovery, setDiscovery] = useState(initialDiscovery);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const isWaiting = discovery.status === "pending";
  const pollingBlocked = ["connection", "unauthorized", "notFound"].includes(error ?? "");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStatus = useRef(discovery.status);

  useEffect(() => {
    if (previousStatus.current !== discovery.status) {
      headingRef.current?.focus();
    }

    previousStatus.current = discovery.status;
  }, [discovery.status]);

  useEffect(() => {
    if (!isWaiting || pollingBlocked) {
      return;
    }

    const state = { active: true, timer: undefined as ReturnType<typeof setTimeout> | undefined };

    async function poll() {
      const { data, error: readError } = await safeAsync(() => readDiscovery(discovery.id));

      if (!state.active) {
        return;
      }

      if (readError || !data || data.status !== "ready") {
        setError(data?.status ?? "connection");
        return;
      }

      setDiscovery(data.discovery);
      state.timer = globalThis.setTimeout(poll, DISCOVERY_POLL_DELAY);
    }

    state.timer = globalThis.setTimeout(poll, DISCOVERY_POLL_DELAY);

    return () => {
      state.active = false;
      globalThis.clearTimeout(state.timer);
    };
  }, [discovery.id, isWaiting, pollingBlocked]);

  function updateDiscovery(next: Discovery, notice?: string) {
    setDiscovery(next);
    setError(notice);
  }

  function start() {
    setError(undefined);

    startTransition(async () => {
      const result = await runClientAction(
        () =>
          startDiscovery({
            discoveryId: discovery.id,
            expectedRevision: discovery.revision,
            language,
          }),
        { status: "unavailable" as const },
      );

      if (result) {
        setError(result.status);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {discovery.status === "ask" && (
        <DiscoveryQuestion
          discovery={discovery}
          key={discovery.revision}
          onUpdate={updateDiscovery}
        />
      )}
      {isWaiting && !pollingBlocked && (
        <div className="flex flex-col gap-3">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold">
            {t("Shaping your learning plan")}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
            <Spinner aria-hidden="true" />
            {t("Thinking about what will help you most…")}
          </p>
        </div>
      )}
      {["ready", "generating", "completed"].includes(discovery.status) && discovery.brief && (
        <>
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">{t("Your learning plan")}</p>
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight">
              {discovery.brief.title}
            </h1>
            <p className="text-muted-foreground text-pretty">{discovery.brief.description}</p>
          </div>
          <Button aria-busy={pending} className="min-h-11 w-fit" disabled={pending} onClick={start}>
            {pending && <Spinner aria-hidden="true" />}
            {discovery.status === "ready" ? t("Start learning") : t("Continue learning")}
          </Button>
        </>
      )}
      {discovery.status === "failed" && (
        <div className="flex flex-col gap-4">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold">
            {t("Let's try that again")}
          </h1>
          <p className="text-muted-foreground">
            {t("Your answers are saved. We couldn't finish preparing the next step.")}
          </p>
          <Button
            aria-busy={pending}
            className="w-fit"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(undefined);

                const result = await runClientAction(() => retryDiscovery(discovery.id), {
                  status: "unavailable" as const,
                });

                if (result.status === "ready") {
                  updateDiscovery(result.discovery, "notice" in result ? result.notice : undefined);
                } else {
                  setError(result.status);
                }
              })
            }
          >
            {pending && <Spinner aria-hidden="true" />}
            {t("Try again")}
          </Button>
        </div>
      )}
      {discovery.status === "blocked" && (
        <div className="flex flex-col gap-4">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold">
            {t("We can't create this course")}
          </h1>
          <Link className={buttonVariants({ className: "w-fit" })} href="/start/learn">
            {t("Try another goal")}
          </Link>
        </div>
      )}
      {error && (
        <DiscoveryFeedback
          discoveryId={discovery.id}
          onRetry={() => setError(undefined)}
          status={error}
        />
      )}
      <DiscoveryAnswers discovery={discovery} onUpdate={updateDiscovery} />
    </div>
  );
}
