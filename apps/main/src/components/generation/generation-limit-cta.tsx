"use client";

import { GenerationShortcutLink } from "@/components/generation/generation-shortcut-link";
import { type AppRoute } from "@/i18n/navigation";
import { type GenerationQuotaLimit } from "@zoonk/core/generation-quotas/contract";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { GaugeIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/** Selects the next useful action from the entitlement that reached its generation limit. */
export function GenerationLimitAction<Href extends string>({
  className,
  loginHref,
  variant = "default",
  viewer,
}: {
  className?: string;
  loginHref: AppRoute<Href>;
  variant?: "default" | "outline";
  viewer: GenerationQuotaLimit["viewer"];
}) {
  const t = useExtracted();

  if (viewer === "guest") {
    return (
      <GenerationShortcutLink className={className} href={loginHref} variant={variant}>
        {t("Log in")}
      </GenerationShortcutLink>
    );
  }

  if (viewer === "authenticated") {
    return (
      <GenerationShortcutLink className={className} href="/subscription" prefetch variant={variant}>
        {t("Subscribe")}
      </GenerationShortcutLink>
    );
  }

  return (
    <GenerationShortcutLink className={className} href="/support" prefetch variant={variant}>
      {t("Contact support")}
    </GenerationShortcutLink>
  );
}

/** Explains that only new generation is paused and offers the role-appropriate next step. */
export function GenerationLimitCTA<BackHref extends string, LoginHref extends string>({
  backHref,
  backLabel,
  limit,
  loginHref,
}: {
  backHref: AppRoute<BackHref>;
  backLabel: string;
  limit: GenerationQuotaLimit;
  loginHref: AppRoute<LoginHref>;
}) {
  const t = useExtracted();

  return (
    <Empty className="border-0">
      <EmptyHeader align="start">
        <EmptyMedia variant="icon">
          <GaugeIcon />
        </EmptyMedia>

        <EmptyTitle aria-level={1} role="heading">
          {t(
            "{period, select, day {Daily} month {Monthly} other {Generation}} {resource, select, course {course} chapter {chapter} lesson {lesson} lessonQuestion {question} other {generation}} limit reached",
            { period: limit.period, resource: limit.resource },
          )}
        </EmptyTitle>

        <EmptyDescription>
          {t(
            "{resource, select, lessonQuestion {{period, select, day {You've reached today's question limit.} month {You've reached this month's question limit.} other {You've reached your question limit.}} Saved answers are still available.} other {{period, select, day {You've reached today's limit} month {You've reached this month's limit} other {You've reached the limit}} for generating {resource, select, course {courses} chapter {chapters} lesson {lessons} other {content}}. You can keep learning from anything already generated.}}",
            { period: limit.period, resource: limit.resource },
          )}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent align="stretch">
        <GenerationShortcutLink href={backHref} prefetch shortcut="Esc" variant="outline">
          {backLabel}
        </GenerationShortcutLink>

        <GenerationLimitAction loginHref={loginHref} viewer={limit.viewer} />
      </EmptyContent>
    </Empty>
  );
}
