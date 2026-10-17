"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { CHIP_CLASS } from "./chip";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "./notice-card";

/**
 * A feature the learner's plan doesn't include, marked where it shows: a row, a card's title, a
 * path's mock. Plus features are never hidden: free learners and guests see them as Plus learners
 * do, with this mark, and they open as usual to a page that says what Plus unlocks. Screen readers
 * hear "Available with Plus" (or `label`, where it marks the learner's own plan). The one way the app draws Plus: a quiet 22px chip on a strong
 * hairline, neither green (right, done) nor blue (information), since a plan is neither.
 */
export function PlusMark({
  className,
  label,
}: {
  className?: string;
  /** What screen readers hear, where the mark is the learner's own plan ("Plus"). */
  label?: string;
}) {
  const t = useExtracted();

  return (
    <span className={cn(CHIP_CLASS, className)} data-slot="plus-mark">
      <span aria-hidden="true">{t("Plus")}</span>
      <span className="sr-only">{label ?? t("Available with Plus")}</span>
    </span>
  );
}

/**
 * The one notice for what the learner's plan doesn't include: "Available with Plus", what Plus
 * unlocks here in one line (`children`), and "See Plus" to the Plus page (the host's `upgrade`
 * route, or `href`). At most one on a page, inline where the locked things are, never a pop-up.
 * `inset` drops its panel for use inside a card or a step that already has one; `cta={false}`
 * drops its link where the screen's main action already goes to Plus (a task's "See Plus").
 * `title` replaces "Available with Plus" where something the free plan had ends (a free exam
 * plan's first week).
 */
export function PlusNotice({
  children,
  className,
  cta = true,
  href,
  inset = false,
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  cta?: boolean;
  href?: string;
  inset?: boolean;
  title?: string;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <NoticeCard
      className={cn(inset && "bg-transparent p-0 ring-0", className)}
      data-slot="plus-notice"
    >
      <NoticeCardLeading className="text-muted-foreground">
        <SparklesIcon />
      </NoticeCardLeading>

      <NoticeCardContent>
        <NoticeCardTitle>{title ?? t("Available with Plus")}</NoticeCardTitle>
        {children && <NoticeCardDescription>{children}</NoticeCardDescription>}

        {cta && (
          <NoticeCardActions>
            <LearnLink
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href={href ?? routes.upgrade}
            >
              {t("See Plus")}
            </LearnLink>
          </NoticeCardActions>
        )}
      </NoticeCardContent>
    </NoticeCard>
  );
}
