import { cn } from "@zoonk/ui/lib/utils";

/** Shown from `lg`; smaller screens reach the same links from their own bar. */
export function Sidebar({ children, className, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 z-30 hidden h-dvh w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r p-3 lg:flex",
        className,
      )}
      data-slot="sidebar"
      {...props}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="sidebar-header" {...props} />
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
      {label && <span className="text-label px-2 pb-1">{label}</span>}
      {children}
    </nav>
  );
}

export const SIDEBAR_ITEM_CLASS =
  "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-foreground focus-visible:ring-ring/50 hit-area press relative flex h-8 min-w-0 items-center gap-2.5 rounded-md px-2 text-[0.84375rem] font-medium outline-none focus-visible:ring-[3px] [&>svg]:size-4 [&>svg]:shrink-0";

export const SIDEBAR_ACCOUNT_CLASS =
  "hover:bg-sidebar-accent/70 aria-expanded:bg-sidebar-accent focus-visible:ring-ring/50 flex h-11 w-full min-w-0 items-center gap-2.5 rounded-md px-1 text-left text-[0.84375rem] font-medium transition-colors outline-none focus-visible:ring-[3px]";

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex items-center gap-2 pt-2", className)}
      data-slot="sidebar-footer"
      {...props}
    />
  );
}
