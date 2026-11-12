"use client";

import { useFreeWeekOverCopy } from "@zoonk/learn/free-week";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { CircleAlertIcon, HourglassIcon, SparklesIcon, UserRoundPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { type LessonRunRefusal } from "../lesson-player-types";
import { AccessLayout, LessonSlowDown } from "./lesson-slow-down";

const PRIMARY_BUTTON = buttonVariants({ size: "xl" });
const SECONDARY_BUTTON = buttonVariants({ size: "xl", variant: "outline" });

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
      <LinkComponent className={PRIMARY_BUTTON} href={routes.upgrade}>
        {t("See Plus")}
      </LinkComponent>
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
      <LinkComponent className={PRIMARY_BUTTON} href={routes.upgrade}>
        {t("See Plus")}
      </LinkComponent>
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
        <a className={PRIMARY_BUTTON} href={routes.signUp}>
          {t("Create a free account")}
        </a>
      </AccessLayout>
    );
  }

  if (tier === "free") {
    return <FreeLimitReached period={period} />;
  }

  return (
    <AccessLayout
      description={t("More tomorrow.")}
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
        description={t("Nothing you did was lost.")}
        icon={<CircleAlertIcon aria-hidden="true" />}
        title={t("We couldn't open this lesson")}
      >
        <Button className={PRIMARY_BUTTON} onClick={actions.retryStart}>
          {t("Try again")}
        </Button>
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
        <a className={PRIMARY_BUTTON} href={routes.signUp}>
          {t("Log in")}
        </a>
      ) : (
        <LinkComponent className={PRIMARY_BUTTON} href={routes.exit}>
          {t("Back")}
        </LinkComponent>
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
