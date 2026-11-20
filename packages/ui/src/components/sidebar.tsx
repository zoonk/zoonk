import { cn } from "@zoonk/ui/lib/utils";
import { TooltipProvider } from "./tooltip";

export type SidebarSide = "end" | "start";

/**
 * `start` is the app's sidebar (`Sidebar`); `end` is a task screen's side column (`TaskAside` in
 * `@zoonk/learn`). Each keeps whether the person collapsed it, on this device.
 */
export const SIDEBAR_STATE = {
  end: { attribute: "data-aside-collapsed", key: "aside-collapsed" },
  start: { attribute: "data-sidebar-collapsed", key: "sidebar-collapsed" },
} as const satisfies Record<SidebarSide, { attribute: string; key: string }>;

const RESTORED = Object.values(SIDEBAR_STATE)
  .map(
    ({ attribute, key }) =>
      `document.documentElement.toggleAttribute(${JSON.stringify(attribute)},localStorage.getItem(${JSON.stringify(key)})==="true")`,
  )
  .join(";");

/** In `<head>`, so a static page paints each sidebar the way the person left it. */
export function SidebarStateScript() {
  return (
    <script
      // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
      dangerouslySetInnerHTML={{ __html: `try{${RESTORED}}catch{}` }}
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

/**
 * Its last child (the toggle) ends the row. Collapsed, the toggle is all it shows, so the row keeps
 * its height and nothing under it moves.
 */
export function SidebarHeaderRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "sidebar-collapsed:*:not-last:hidden flex min-w-0 items-center justify-between gap-1",
        className,
      )}
      data-slot="sidebar-header-row"
      {...props}
    />
  );
}

/**
 * What sits between the header and the footer. It scrolls by itself when the window is short, so
 * the footer stays in reach; its padding keeps a row's focus ring inside what scrolls.
 */
export function SidebarBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("-m-3 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3", className)}
      data-slot="sidebar-body"
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
      {/* Collapsed, the label keeps its one line of room, so the icons under it stay put. */}
      {label && (
        <span className="text-faint sidebar-collapsed:invisible truncate px-2 pb-1 text-xs leading-4 font-medium">
          {label}
        </span>
      )}
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

/** Under `lg` the sidebar is hidden, so an item there is a row of a phone's menu sheet: 44px to press. */
export const SIDEBAR_ITEM_CLASS = cn(
  "text-muted-foreground hover:bg-muted/60 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground focus-visible:ring-ring/50 hit-area press text-compact relative flex h-8 min-w-0 items-center gap-2.5 rounded-md px-2 font-medium outline-none focus-visible:ring-[3px] max-lg:h-11 [&>svg]:size-4 [&>svg]:shrink-0",
  SIDEBAR_ICON_ONLY_CLASS,
);

/**
 * A count after an item's label; collapsed, the item's tooltip repeats it. On the current item's
 * fill a faint count would drop under AA.
 */
export const SIDEBAR_COUNT_CLASS =
  "text-faint in-aria-[current=page]:text-muted-foreground in-data-[slot=tooltip-content]:text-background/70 font-mono text-xs tabular-nums in-data-[slot=tooltip-content]:ml-2";

/** Its 24px picture hangs 4px out each side, so it centers on the items' icons and the name starts with their labels. */
export const SIDEBAR_ACCOUNT_CLASS = cn(
  "hover:bg-muted/60 aria-expanded:bg-muted focus-visible:ring-ring/50 hit-area text-compact relative flex h-11 w-full min-w-0 items-center gap-2.5 rounded-md px-2 text-left font-medium transition-colors outline-none *:first:-mx-1 focus-visible:ring-[3px]",
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
