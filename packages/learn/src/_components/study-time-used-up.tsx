"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { TaskMainLink } from "../shell/task-frame";
import { TaskActions } from "./task-layout";

/**
 * Not an alert: its footer's status region reads it out, and Next.js announces a new page itself.
 */
export function StudyTimeUsedUpNote({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm text-pretty">{children}</p>;
}

export function StudyTimeUsedUpActions({ href, main }: { href: string; main?: React.ReactNode }) {
  const t = useExtracted();

  if (!main) {
    return (
      <TaskActions>
        <TaskMainLink href={href}>{t("Back to Today")}</TaskMainLink>
      </TaskActions>
    );
  }

  return (
    <TaskActions className="max-lg:flex-col max-lg:items-stretch">
      <LearnLink className={buttonVariants({ size: "xl", variant: "outline" })} href={href}>
        {t("Back to Today")}
      </LearnLink>
      {main}
    </TaskActions>
  );
}
