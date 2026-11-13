"use client";

import { EnterButton, EnterLink } from "@zoonk/learn/enter-button";
import { useFreeWeekOverCopy } from "@zoonk/learn/free-week";
import { buttonVariants } from "@zoonk/ui/components/button";
import { CircleAlertIcon, HourglassIcon, SparklesIcon, UserRoundPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { type LessonRunRefusal } from "../lesson-player-types";
import { AccessLayout, LessonSlowDown } from "./lesson-slow-down";

/** Beside "Back" from `sm`, the main action keeps its own width as it did. */
const PRIMARY_CLASS = "sm:grow-0 sm:basis-auto";
const SECONDARY_BUTTON = buttonVariants({ size: "xl", variant: "outline" });

/** Sign-in leaves the app's router, so it's a full page load. */
function PageLink({ children, ...props }: React.ComponentProps<"a">) {
  return <a {...props}>{children}</a>;
}

function SlowDown({ retryAfterSeconds }: { retryAfterSeconds: number }) {
  const { actions } = useLessonPlayer();
  return <LessonSlowDown onRetry={actions.retryStart} retryAfterSeconds={retryAfterSeconds} />;
}

function FreeLimitReached({ period }: { period: "day" | "month" | "total" }) {
  const t = useExtracted();
  const { linkComponent: LinkComponent, routes, track } = useLessonPlayerConfig();

  useEffect(() => {
    track({ name: "Subscription Gate Shown" });
  }, [track]);

  return (
    <AccessLayout
      description={
        period === "month"
          ? t("You can still review and practice your mistakes. More next month, or now with Plus.")
          : t("You can still review and practice your mistakes. More tomorrow, or now with Plus.")
      }
      icon={<SparklesIcon aria-hidden="true" />}
      title={
        period === "month" ? t("No more new lessons this month") : t("No more new lessons today")
      }
    >
      <EnterLink className={PRIMARY_CLASS} href={routes.upgrade} icon={null} link={LinkComponent}>
        {t("See Plus")}
      </EnterLink>
      <LinkComponent className={SECONDARY_BUTTON} href={routes.exit}>
        {t("Back")}
      </LinkComponent>
    </AccessLayout>
  );
}

function FreeWeekOver() {
  const t = useExtracted();
  const { body, title } = useFreeWeekOverCopy();
  const { linkComponent: LinkComponent, routes, track } = useLessonPlayerConfig();

  useEffect(() => {
    track({ name: "Subscription Gate Shown" });
  }, [track]);

  return (
    <AccessLayout description={body} icon={<SparklesIcon aria-hidden="true" />} title={title}>
      <EnterLink className={PRIMARY_CLASS} href={routes.upgrade} icon={null} link={LinkComponent}>
        {t("See Plus")}
      </EnterLink>
      <LinkComponent className={SECONDARY_BUTTON} href={routes.exit}>
        {t("Back")}
      </LinkComponent>
    </AccessLayout>
  );
}

function LimitReached({
  period,
  tier,
}: {
  period: "day" | "month" | "total";
  tier: "free" | "guest" | "plus";
}) {
  const t = useExtracted();
  const { linkComponent: LinkComponent, routes } = useLessonPlayerConfig();

  if (tier === "guest") {
    return (
      <AccessLayout
        description={t("Everything you learned comes with you.")}
        icon={<UserRoundPlusIcon aria-hidden="true" />}
        title={t("No more lessons without an account")}
      >
        <EnterLink className={PRIMARY_CLASS} href={routes.signUp} icon={null} link={PageLink}>
          {t("Create a free account")}
        </EnterLink>
      </AccessLayout>
    );
  }

  if (tier === "free") {
    return <FreeLimitReached period={period} />;
  }

  return (
    <AccessLayout
      description={t("You can still review and practice your mistakes. More tomorrow.")}
      icon={<HourglassIcon aria-hidden="true" />}
      title={t("No more new lessons today")}
    >
      <LinkComponent className={SECONDARY_BUTTON} href={routes.exit}>
        {t("Back")}
      </LinkComponent>
    </AccessLayout>
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
        icon={<CircleAlertIcon aria-hidden="true" />}
        title={t("We couldn't open this lesson")}
      >
        <EnterButton className={PRIMARY_CLASS} onClick={actions.retryStart}>
          {t("Try again")}
        </EnterButton>
      </AccessLayout>
    );
  }

  return (
    <AccessLayout
      icon={<CircleAlertIcon aria-hidden="true" />}
      title={
        refusal.reason === "unauthorized"
          ? t("You've been logged out")
          : t("This lesson isn't available")
      }
    >
      {refusal.reason === "unauthorized" ? (
        <EnterLink className={PRIMARY_CLASS} href={routes.signUp} icon={null} link={PageLink}>
          {t("Log in")}
        </EnterLink>
      ) : (
        <EnterLink className={PRIMARY_CLASS} href={routes.exit} icon={null} link={LinkComponent}>
          {t("Back")}
        </EnterLink>
      )}
    </AccessLayout>
  );
}

export function LessonAccessScreen({ refusal }: { refusal: LessonRunRefusal }) {
  if (refusal.reason === "slowDown") {
    return <SlowDown retryAfterSeconds={refusal.retryAfterSeconds} />;
  }

  if (refusal.reason === "plusRequired") {
    return <FreeWeekOver />;
  }

  if (refusal.reason === "limitReached") {
    return <LimitReached period={refusal.period} tier={refusal.tier} />;
  }

  return <Unavailable refusal={refusal} />;
}
