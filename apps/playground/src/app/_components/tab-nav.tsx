"use client";

import { TAB_CLASS, TAB_LIST_CLASS } from "@zoonk/ui/components/tab-class";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";

/**
 * A row of links drawn as tabs. The current one's fill reaches 10px past the column on both
 * sides, like a highlighted row, so the first label starts on the column's edge. A client
 * component because the tab classes live in a client module, which a server component can't read.
 */
export function TabNav({
  className,
  label,
  options,
}: {
  className?: string;
  label: string;
  options: readonly { href: string; isActive: boolean; label: string }[];
}) {
  return (
    <nav aria-label={label} className={cn(TAB_LIST_CLASS, "-mx-2.5", className)}>
      {options.map((option) => (
        <Link
          aria-current={option.isActive ? "page" : undefined}
          className={TAB_CLASS}
          href={option.href}
          key={option.href}
          prefetch
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
