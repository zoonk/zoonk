"use client";

import { EnterButton, EnterLink } from "@zoonk/learn/enter-button";
import { type LessonLimit, useLessonLimitWords } from "@zoonk/learn/help-limit";
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

/** The gate: what a free learner reads when a new lesson needs a subscription. */
function SubscribeGateScreen({ limit }: { limit: ReachedLimit }) {
  const t = useExtracted();
  const { title = "" } = useLessonLimitWords(limit);
  const description = useStillFreeLine(limit);
  const { linkComponent: LinkComponent, routes, track } = useLessonPlayerConfig();

  useEffect(() => {
    track({ name: "Subscription Gate Shown" });
  }, [track]);

  return (
    <AccessLayout
      actions={
        <EnterLink href={routes.upgrade} link={LinkComponent}>
          {t("Subscribe")}
        </EnterLink>
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
        <EnterLink href={routes.signUp} link={PageLink}>
          {t("Create a free account")}
        </EnterLink>
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
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();

  if (refusal.reason === "failed") {
    return (
      <AccessLayout
        actions={<EnterButton onClick={actions.retryStart}>{t("Try again")}</EnterButton>}
        icon={<CircleAlertIcon aria-hidden="true" />}
        title={t("We couldn't open this lesson")}
      />
    );
  }

  return (
    <AccessLayout
      actions={
        refusal.reason === "unauthorized" ? (
          <EnterLink href={routes.signUp} link={PageLink}>
            {t("Log in")}
          </EnterLink>
        ) : (
          <EnterLink href={routes.exit} link={LinkComponent}>
            {t("Back")}
          </EnterLink>
        )
      }
      icon={<CircleAlertIcon aria-hidden="true" />}
      title={
        refusal.reason === "unauthorized"
          ? t("You've been logged out")
          : t("This lesson isn't available")
      }
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
