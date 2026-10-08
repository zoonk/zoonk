"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { SURFACE_CLASS } from "./surface";

/**
 * A feature the learner's plan doesn't include, marked where it shows: a row, a card's title, a
 * path's mock. Plus features are never hidden: free learners and guests see them as Plus learners
 * do, with this mark, and they open as usual to a page that says what Plus unlocks. Screen readers
 * hear "Available with Plus".
 */
export function PlusMark({ className }: { className?: string }) {
  const t = useExtracted();

  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium",
        className,
      )}
      data-slot="plus-mark"
    >
      <SparklesIcon aria-hidden="true" className="size-3" />
      <span aria-hidden="true">{t("Plus")}</span>
      <span className="sr-only">{t("Available with Plus")}</span>
    </span>
  );
}

/**
 * The one notice for what the learner's plan doesn't include: "Available with Plus", what Plus
 * unlocks here in one line (`children`), and "See Plus" to the Plus page (the host's `upgrade`
 * route, or `href`). At most one on a page, inline where the locked things are, never a pop-up.
 * `inset` drops its surface for use inside a card or a step that already has one; `cta={false}`
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
    <div
      className={cn(
        "flex items-start gap-3 text-sm leading-5",
        !inset && cn(SURFACE_CLASS, "p-4"),
        className,
      )}
      data-slot="plus-notice"
    >
      <span
        aria-hidden="true"
        className="bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
      >
        <SparklesIcon className="size-4" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className="font-medium">{title ?? t("Available with Plus")}</p>
        {children && <p className="text-muted-foreground text-pretty">{children}</p>}

        {cta && (
          <LearnLink
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-2")}
            href={href ?? routes.upgrade}
          >
            {t("See Plus")}
          </LearnLink>
        )}
      </div>
    </div>
  );
}
