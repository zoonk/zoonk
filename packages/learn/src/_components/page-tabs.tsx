"use client";

import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import {
  TAB_CLASS,
  TAB_LIST_CLASS,
  TAB_ROW_CLASS,
  TAB_ROW_COUNT_CLASS,
  TAB_SCROLL_ROW_CLASS,
} from "@zoonk/ui/components/tab-class";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
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

/** Views a learner's own data decides, so there can be more than fit: one row that scrolls sideways. */
export function PageTabsScroll({
  children,
  className,
  label,
  ...props
}: Omit<React.ComponentProps<"nav">, "aria-label"> & { label: string }) {
  const t = useExtracted();

  return (
    // The scrolling row keeps 8px under its tabs, which the margin gives back.
    <nav aria-label={label} className={cn("-mb-2", className)} {...props}>
      <HorizontalScroll
        className={TAB_SCROLL_ROW_CLASS}
        labels={{ left: t("Scroll left"), right: t("Scroll right") }}
      >
        <HorizontalScrollContent className={TAB_LIST_CLASS} data-tabs>
          <ul className="contents">{children}</ul>
        </HorizontalScrollContent>
      </HorizontalScroll>
    </nav>
  );
}

/** The same views as a column, where there's room beside what they switch. */
export function PageTabsColumn({
  children,
  label,
  ...props
}: Omit<React.ComponentProps<"nav">, "aria-label"> & { label: string }) {
  return (
    <nav aria-label={label} {...props}>
      <ul className="-mx-2.5 flex flex-col gap-0.5" data-tabs>
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

function revealTab(tab: HTMLLIElement | null) {
  tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function PageTab({
  children,
  count,
  current,
  href,
  onSelect,
  row = false,
}: {
  children: React.ReactNode;
  count: number;
  current: boolean;
  href: string;
  /** Shows the tab on the page itself, which already holds every tab, instead of loading `href`. */
  onSelect?: () => void;
  /** A row of `PageTabsColumn`: its count ends the row. */
  row?: boolean;
}) {
  return (
    <li className="scroll-mx-16" ref={current && !row ? revealTab : undefined}>
      <LearnLink
        aria-current={current ? "page" : undefined}
        className={row ? TAB_ROW_CLASS : TAB_CLASS}
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
        {row ? <span className="truncate">{children}</span> : children}
        <span className={row ? TAB_ROW_COUNT_CLASS : "font-mono text-xs tabular-nums"}>
          {count}
        </span>
      </LearnLink>
    </li>
  );
}
