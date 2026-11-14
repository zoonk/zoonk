"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardLeading,
  NoticeCardTitle,
} from "./notice-card";

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
  /** What is locked, as the notice's one message: "Mock exams come with Plus". */
  title: string;
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
        <NoticeCardTitle>{title}</NoticeCardTitle>
        {children && <NoticeCardDescription>{children}</NoticeCardDescription>}

        {(cta || action) && (
          <NoticeCardActions>
            {cta && (
              <LearnLink
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href={href ?? routes.upgrade}
              >
                {t("Subscribe")}
              </LearnLink>
            )}
            {action}
          </NoticeCardActions>
        )}
      </NoticeCardContent>
    </NoticeCard>
  );
}
