"use client";

import { TAB_CLASS, TAB_LIST_CLASS } from "@zoonk/ui/components/tab-class";
import { cn } from "@zoonk/ui/lib/utils";
import { LearnLink } from "../learn-link";
import { TAB_ROW_GAP_CLASS } from "./page";

/** A page's views as links, each with how many things it lists. */
export function PageTabs({
  children,
  label,
  ...props
}: Omit<React.ComponentProps<"nav">, "aria-label"> & { label: string }) {
  return (
    <nav aria-label={label} {...props}>
      <ul className={cn(TAB_LIST_CLASS, "-mx-2.5 flex-wrap")} data-tabs>
        {children}
      </ul>
    </nav>
  );
}

/**
 * The tabs and the views they switch. Under a detail page's header it gives back 8px of the layout's
 * 32px, so its tabs sit on the title's next row, as a section's do (`TAB_ROW_GAP_CLASS`).
 */
export function PageTabsGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(TAB_ROW_GAP_CLASS, "-mt-2", className)} {...props} />;
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
