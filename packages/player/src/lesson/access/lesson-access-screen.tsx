"use client";

import { useFreeWeekOverCopy } from "@zoonk/learn/free-week";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { CircleAlertIcon, HourglassIcon, SparklesIcon, UserRoundPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { type LessonRunRefusal } from "../lesson-player-types";
import { AccessLayout, LessonSlowDown } from "./lesson-slow-down";

/** The screen's buttons match the lesson's main action: the same size and shape. */
const PRIMARY_BUTTON = buttonVariants({ size: "xl" });
const SECONDARY_BUTTON = buttonVariants({ size: "xl", variant: "outline" });

/** Fair use spaces new lessons out; the run starts again when the wait is over. */
function SlowDown({ retryAfterSeconds }: { retryAfterSeconds: number }) {
  const { actions } = useLessonPlayer();
  return <LessonSlowDown onRetry={actions.retryStart} retryAfterSeconds={retryAfterSeconds} />;
}

/**
 * The free plan's paywall: the learner started the new lessons their plan includes for the day or
 * the month. Reviews and mistakes stay open, so it says when new lessons come back and offers Plus
 * as a choice, not a wall.
 */
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
          ? t(
              "You can still review what you learned and practice your mistakes. New lessons open again next month, or get Plus to keep going now.",
            )
          : t(
              "You can still review what you learned and practice your mistakes. New lessons open again tomorrow, or get Plus to keep going now.",
            )
      }
      icon={<SparklesIcon aria-hidden="true" />}
      title={
        period === "month"
          ? t("That's all the new lessons for this month")
          : t("That's all the new lessons for today")
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

/**
 * A free exam plan past its first week: its new lessons come with Plus, while reviews and fixing
 * mistakes stay free, as Today says. Plus is a choice, with the way back beside it.
 */
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
        description={t(
          "You've taken the lessons you can try without an account. Create a free account to keep going, and everything you learned comes with you.",
        )}
        icon={<UserRoundPlusIcon aria-hidden="true" />}
        title={t("Save your progress to keep going")}
      >
        <LinkComponent className={PRIMARY_BUTTON} href={routes.signUp}>
          {t("Create a free account")}
        </LinkComponent>
      </AccessLayout>
    );
  }

  if (tier === "free") {
    return <FreeLimitReached period={period} />;
  }

  return (
    <AccessLayout
      description={t("You've reached today's limit. New lessons open again tomorrow.")}
      icon={<HourglassIcon aria-hidden="true" />}
      title={t("That's a lot of learning today")}
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
        description={t("Try again in a moment. Nothing you did was lost.")}
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
      description={
        refusal.reason === "unauthorized"
          ? t("Sign in to keep learning.")
          : t("This lesson isn't available anymore.")
      }
      icon={<CircleAlertIcon aria-hidden="true" />}
      title={
        refusal.reason === "unauthorized" ? t("Sign in to continue") : t("Lesson not available")
      }
    >
      <LinkComponent
        className={PRIMARY_BUTTON}
        href={refusal.reason === "unauthorized" ? routes.signUp : routes.exit}
      >
        {refusal.reason === "unauthorized" ? t("Sign in") : t("Back")}
      </LinkComponent>
    </AccessLayout>
  );
}

/**
 * When a lesson can't start: a calm wait for fair use, a sign-up for a guest who used their
 * lessons, Plus for a free learner (out of lessons, or past a free exam plan's first week), or a
 * retry when the connection failed. Never a dead end.
 */
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
