"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ChevronRightIcon, type LucideIcon } from "lucide-react";
import { LearnLink } from "../learn-link";

/**
 * A page one tap from Progress (the exam, the mistakes notebook): an icon, a title and one line
 * of context. The icon and chevron sit on the title's line, so a subtitle that wraps in a longer
 * language grows the row downward instead of pulling them off the title.
 */
export function ProgressLinkRow({
  href,
  icon: Icon,
  subtitle,
  title,
}: {
  href: string;
  icon: LucideIcon;
  subtitle: string;
  title: string;
}) {
  return (
    <LearnLink
      className="bg-muted in-data-[mode=fun]:fun-glass hover:bg-muted/70 focus-visible:ring-ring/50 flex min-h-14 items-start gap-3 rounded-2xl px-4 py-3 text-sm outline-none focus-visible:ring-[3px]"
      href={href}
    >
      <LineMarker aria-hidden="true">
        <Icon className="text-muted-foreground size-5" />
      </LineMarker>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">{subtitle}</span>
      </span>
      <LineMarker aria-hidden="true">
        <ChevronRightIcon className="text-muted-foreground size-4" />
      </LineMarker>
    </LearnLink>
  );
}
