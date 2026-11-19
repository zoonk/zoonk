"use client";

import { EnterButton, EnterLink } from "@zoonk/learn/enter-button";
import { type LessonLimit, useFreeLessonReady, useLessonLimitWords } from "@zoonk/learn/help-limit";
import { buttonVariants } from "@zoonk/ui/components/button";
import { CircleAlertIcon, HourglassIcon, SparklesIcon, UserRoundPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { type LessonRunRefusal } from "../lesson-player-types";
import { AccessLayout, LessonSlowDown } from "./lesson-slow-down";

/** Sign-in leaves the app's router, so it's a full page load. */
function PageLink({ children, ...props }: React.ComponentProps<"a">) {
  return <a {...props}>{children}</a>;
}

function SlowDown({ retryAfterSeconds }: { retryAfterSeconds: number }) {
  const { actions } = useLessonPlayer();
  return <LessonSlowDown onRetry={actions.retryStart} retryAfterSeconds={retryAfterSeconds} />;
}

type ReachedLimit = Extract<LessonLimit, { status: "limitReached" }>;

function useStillFreeLine(limit: ReachedLimit): string {
  const t = useExtracted();
  const { line = "" } = useLessonLimitWords(limit);

  return `${t("You can still review and practice your mistakes.")} ${line}`;
}

function FreeLessonActions({ children }: { children: React.ReactNode }) {
  const t = useExtracted();
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();

  return (
    <div className="flex w-full flex-col items-center gap-2 *:first:w-full lg:w-auto">
      {children}
      <LinkComponent className={buttonVariants({ variant: "ghost" })} href={routes.mistakes}>
        {t({
          description:
            "A button under Subscribe on the screen that says the free lessons are used up. It opens practice on the learner's past mistakes.",
          message: "Practice your mistakes",
        })}
      </LinkComponent>
    </div>
  );
}

/** Once the next free lesson opens, the gate offers to start it; the server decides again. */
function FreeLessonReady({ title }: { title: string }) {
  const t = useExtracted();
  const { actions } = useLessonPlayer();

  return (
    <AccessLayout
      actions={
        <FreeLessonActions>
          <EnterButton onClick={actions.retryStart}>{t("Start the lesson")}</EnterButton>
        </FreeLessonActions>
      }
      icon={<SparklesIcon aria-hidden="true" />}
      title={title}
    />
  );
}

/** The gate: what a free learner reads when a new lesson needs a subscription. */
function SubscribeGateScreen({ limit }: { limit: ReachedLimit }) {
  const t = useExtracted();
  const { title = "" } = useLessonLimitWords(limit);
  const description = useStillFreeLine(limit);
  const ready = useFreeLessonReady(limit);
  const { linkComponent: LinkComponent, routes, track } = useLessonPlayerConfig();

  useEffect(() => {
    track({ name: "Subscription Gate Shown" });
  }, [track]);

  if (ready) {
    return <FreeLessonReady title={title} />;
  }

  return (
    <AccessLayout
      actions={
        <FreeLessonActions>
          <EnterLink href={routes.upgrade} link={LinkComponent}>
            {t("Subscribe")}
          </EnterLink>
        </FreeLessonActions>
      }
      description={description}
      icon={<SparklesIcon aria-hidden="true" />}
      title={title}
    />
  );
}

function SubscriberLimitReached({ limit }: { limit: ReachedLimit }) {
  const t = useExtracted();
  const { title = "" } = useLessonLimitWords(limit);
  const description = useStillFreeLine(limit);
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();

  return (
    <AccessLayout
      actions={
        <EnterLink href={routes.exit} link={LinkComponent}>
          {t("Back")}
        </EnterLink>
      }
      description={description}
      icon={<HourglassIcon aria-hidden="true" />}
      title={title}
    />
  );
}

function GuestLimitReached({ limit }: { limit: ReachedLimit }) {
  const t = useExtracted();
  const { title = "" } = useLessonLimitWords(limit);
  const { routes } = useLessonPlayerConfig();

  return (
    <AccessLayout
      actions={
        <div className="flex w-full flex-col items-center gap-2 *:first:w-full lg:w-auto">
          <EnterLink href={routes.signUp} link={PageLink}>
            {t("Create a free account")}
          </EnterLink>
          <PageLink className={buttonVariants({ variant: "ghost" })} href={routes.signUp}>
            {t("Log in")}
          </PageLink>
        </div>
      }
      description={t("Everything you learned comes with you.")}
      icon={<UserRoundPlusIcon aria-hidden="true" />}
      title={title}
    />
  );
}

function LimitReached({ limit }: { limit: ReachedLimit }) {
  if (limit.tier === "guest") {
    return <GuestLimitReached limit={limit} />;
  }

  return limit.tier === "free" ? (
    <SubscribeGateScreen limit={limit} />
  ) : (
    <SubscriberLimitReached limit={limit} />
  );
}

function Unavailable({
  refusal,
}: {
  refusal: Extract<LessonRunRefusal, { reason: "failed" | "notFound" | "unauthorized" }>;
}) {
  const t = useExtracted();
  const { actions } = useLessonPlayer();
  const { linkComponent, routes } = useLessonPlayerConfig();

  if (refusal.reason === "failed") {
    return (
      <AccessLayout
        actions={<EnterButton onClick={actions.retryStart}>{t("Try again")}</EnterButton>}
        description={t("Nothing was lost. Try again in a moment.")}
        icon={<CircleAlertIcon aria-hidden="true" />}
        title={t("We couldn't open this lesson")}
      />
    );
  }

  if (refusal.reason === "notFound") {
    return (
      <AccessLayout
        actions={
          <EnterLink href="/today" link={linkComponent}>
            {t("Today")}
          </EnterLink>
        }
        description={t("The link may be old or mistyped.")}
        heading="h1"
        icon={<CircleAlertIcon aria-hidden="true" />}
        title={t("This lesson isn't available")}
      />
    );
  }

  return (
    <AccessLayout
      actions={
        <EnterLink href={routes.signUp} link={PageLink}>
          {t("Log in")}
        </EnterLink>
      }
      icon={<CircleAlertIcon aria-hidden="true" />}
      title={t("You've been logged out")}
    />
  );
}

export function LessonAccessScreen({ refusal }: { refusal: LessonRunRefusal }) {
  if (refusal.reason === "slowDown") {
    return <SlowDown retryAfterSeconds={refusal.retryAfterSeconds} />;
  }

  if (refusal.reason === "limitReached") {
    const { reason: _reason, ...limit } = refusal;
    return <LimitReached limit={{ ...limit, status: "limitReached" }} />;
  }

  return <Unavailable refusal={refusal} />;
}
