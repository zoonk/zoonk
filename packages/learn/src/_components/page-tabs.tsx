"use client";

import { LearnLink } from "../learn-link";

const TAB_CLASS =
  "focus-visible:ring-ring/50 hit-area relative flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1 text-[0.8125rem] font-medium outline-none transition-colors focus-visible:ring-[3px] aria-[current=page]:bg-muted aria-[current=page]:text-foreground text-muted-foreground hover:text-foreground hover:bg-muted/70";

/** A page's views as links, each with how many things it lists. */
export function PageTabs({
  children,
  label,
  ...props
}: Omit<React.ComponentProps<"nav">, "aria-label"> & { label: string }) {
  return (
    <nav aria-label={label} {...props}>
      <ul className="flex flex-wrap items-center gap-1">{children}</ul>
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
