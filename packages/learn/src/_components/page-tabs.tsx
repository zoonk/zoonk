"use client";

import { TAB_CLASS, TAB_LIST_CLASS } from "@zoonk/ui/components/tabs";
import { cn } from "@zoonk/ui/lib/utils";
import { LearnLink } from "../learn-link";

/** A page's views as links, each with how many things it lists. */
export function PageTabs({
  children,
  label,
  ...props
}: Omit<React.ComponentProps<"nav">, "aria-label"> & { label: string }) {
  return (
    <nav aria-label={label} {...props}>
      <ul className={cn(TAB_LIST_CLASS, "-mx-2.5 flex-wrap")}>{children}</ul>
    </nav>
  );
}

export function PageTab({
  children,
  count,
  current,
  href,
  onSelect,
}: {
  children: React.ReactNode;
  count: number;
  current: boolean;
  href: string;
  /** Shows the tab on the page itself, which already holds every tab, instead of loading `href`. */
  onSelect?: () => void;
}) {
  return (
    <li>
      <LearnLink
        aria-current={current ? "page" : undefined}
        className={TAB_CLASS}
        href={href}
        onNavigate={
          onSelect &&
          ((event) => {
            event.preventDefault();

            if (!current) {
              onSelect();
            }
          })
        }
        prefetch={!onSelect}
      >
        {children}
        <span className="font-mono text-xs tabular-nums">{count}</span>
      </LearnLink>
    </li>
  );
}
