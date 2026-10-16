"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { TaskMainLink } from "../shell/task-frame";
import { TaskActions } from "./task-layout";

/**
 * An intro's line once today's study time is used up: when its call or challenge is back. The
 * owning footer puts it in its status region, mounted from the start, so a line that replaces a
 * refused Start is read out as it arrives; a page that opens past the limit says where things
 * stand without an alert, since Next.js already announces the new page assertively.
 */
export function StudyTimeUsedUpLine() {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-sm text-pretty">
      {t("You've reached today's study time. It'll be here tomorrow.")}
    </p>
  );
}

/**
 * The way back to Today in Start's place, with nothing to start, and a secondary action that isn't
 * study, such as the week's challenge's Move to Monday, before it: beside it from `lg`, the main
 * action last, and above it on a phone, where both labels don't fit side by side in every language.
 */
export function StudyTimeUsedUpActions({
  children,
  href,
}: {
  children?: React.ReactNode;
  href: string;
}) {
  const t = useExtracted();

  return (
    <TaskActions className={cn(children && "max-lg:flex-col max-lg:items-stretch")}>
      {children}
      <TaskMainLink href={href}>{t("Back to Today")}</TaskMainLink>
    </TaskActions>
  );
}
