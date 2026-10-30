import { cn } from "@zoonk/ui/lib/utils";
import { TooltipProvider } from "./tooltip";

export const SIDEBAR_COLLAPSED_ATTRIBUTE = "data-sidebar-collapsed";
export const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

/** In `<head>`, so a static page paints the sidebar at the width the person left it. */
export function SidebarStateScript() {
  return (
    <script
      // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
      dangerouslySetInnerHTML={{
        __html: `try{document.documentElement.toggleAttribute(${JSON.stringify(SIDEBAR_COLLAPSED_ATTRIBUTE)},localStorage.getItem(${JSON.stringify(SIDEBAR_COLLAPSED_KEY)})==="true")}catch{}`,
      }}
    />
  );
}

/** Shown from `lg`; smaller screens reach the same links from their own bar. */
export function Sidebar({ children, className, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside
      className={cn(
        "bg-background text-foreground sidebar-collapsed:w-[calc(3.5rem+1px)] sticky top-0 z-30 hidden h-dvh w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r p-3 lg:flex",
        className,
      )}
      data-slot="sidebar"
      {...props}
    >
      <TooltipProvider delay={400}>{children}</TooltipProvider>
    </aside>
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="sidebar-header" {...props} />
  );
}

/** Its last child (the toggle) ends the row, and goes under the rest once collapsed. */
export function SidebarHeaderRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "sidebar-collapsed:flex-col sidebar-collapsed:gap-2 flex min-w-0 items-center justify-between gap-1",
        className,
      )}
      data-slot="sidebar-header-row"
      {...props}
    />
  );
}

export function SidebarSection({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<"nav"> & { label?: string }) {
  return (
    <nav className={cn("flex flex-col gap-0.5", className)} data-slot="sidebar-section" {...props}>
      {label && <span className="text-label sidebar-collapsed:hidden px-2 pb-1">{label}</span>}
      {children}
    </nav>
  );
}

/**
 * An item is its icon, then its label and whatever follows; collapsed, only the icon shows and the
 * rest stays for screen readers.
 */
export const SIDEBAR_ICON_ONLY_CLASS =
  "sidebar-collapsed:justify-center sidebar-collapsed:*:not-first:sr-only";

export const SIDEBAR_ITEM_CLASS = cn(
  "text-muted-foreground hover:bg-muted/60 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground focus-visible:ring-ring/50 hit-area press relative flex h-8 min-w-0 items-center gap-2.5 rounded-md px-2 text-[0.84375rem] font-medium outline-none focus-visible:ring-[3px] [&>svg]:size-4 [&>svg]:shrink-0",
  SIDEBAR_ICON_ONLY_CLASS,
);

/**
 * A count after an item's label; collapsed, the item's tooltip repeats it. On the current item's
 * fill a faint count would drop under AA.
 */
export const SIDEBAR_COUNT_CLASS =
  "text-faint in-aria-[current=page]:text-muted-foreground in-data-[slot=tooltip-content]:text-background/70 font-mono text-xs tabular-nums in-data-[slot=tooltip-content]:ml-2";

export const SIDEBAR_ACCOUNT_CLASS = cn(
  "hover:bg-muted/60 aria-expanded:bg-muted focus-visible:ring-ring/50 hit-area relative flex h-11 w-full min-w-0 items-center gap-2.5 rounded-md px-1 text-left text-[0.84375rem] font-medium transition-colors outline-none focus-visible:ring-[3px]",
  SIDEBAR_ICON_ONLY_CLASS,
);

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-0.5 pt-2", className)}
      data-slot="sidebar-footer"
      {...props}
    />
  );
}
