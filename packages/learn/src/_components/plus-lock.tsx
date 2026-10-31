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

export function PlusMark({ className, label }: { className?: string; label?: string }) {
  const t = useExtracted();

  return (
    <span className={cn(CHIP_CLASS, className)} data-slot="plus-mark">
      <span aria-hidden="true">{t("Plus")}</span>
      <span className="sr-only">{label ?? t("Available with Plus")}</span>
    </span>
  );
}

export function PlusNotice({
  action,
  children,
  className,
  cta = true,
  href,
  inset = false,
  title,
}: {
  action?: React.ReactNode;
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
            {action}
          </NoticeCardActions>
        )}
      </NoticeCardContent>
    </NoticeCard>
  );
}
