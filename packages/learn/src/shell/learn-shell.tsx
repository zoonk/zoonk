import { cn } from "@zoonk/ui/lib/utils";

/** These parts render on the server. */
export function LearnShell({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-background text-foreground flex min-h-dvh flex-col lg:has-[>[data-slot=learn-sidebar]]:flex-row",
        className,
      )}
      data-slot="learn-shell"
      {...props}
    >
      {children}
    </div>
  );
}

/** Wide pages and the page bar leave this width out of the viewport. */
const SIDEBAR_WIDTH_CLASS = "w-60";

export function LearnSidebar({ children, className, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 z-30 hidden h-dvh shrink-0 flex-col gap-5 overflow-y-auto border-r p-3 lg:flex",
        SIDEBAR_WIDTH_CLASS,
        className,
      )}
      data-slot="learn-sidebar"
      {...props}
    >
      {children}
    </aside>
  );
}

export function LearnSidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="learn-sidebar-header"
      {...props}
    />
  );
}

export function LearnSidebarSection({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<"nav"> & { label?: string }) {
  return (
    <nav
      className={cn("flex flex-col gap-0.5", className)}
      data-slot="learn-sidebar-section"
      {...props}
    >
      {label && <span className="text-label px-2 pb-1">{label}</span>}
      {children}
    </nav>
  );
}

export const LEARN_SIDEBAR_ITEM_CLASS =
  "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-foreground focus-visible:ring-ring/50 hit-area press relative flex h-8 min-w-0 items-center gap-2.5 rounded-md px-2 text-[0.84375rem] font-medium outline-none focus-visible:ring-[3px] [&>svg]:size-4 [&>svg]:shrink-0";

export function LearnSidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex items-center gap-2 pt-2", className)}
      data-slot="learn-sidebar-footer"
      {...props}
    />
  );
}

export function LearnShellContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col", className)}
      data-slot="learn-shell-content"
      {...props}
    />
  );
}

export function LearnShellHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header className={className} data-slot="learn-shell-header" {...props}>
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(2.75rem,auto)] items-center gap-x-3 lg:grid-rows-[minmax(2.5rem,auto)]",
          BAR_ROW_CLASS,
        )}
      >
        {children}
      </div>
    </header>
  );
}

export function LearnShellStart({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("col-start-1 row-start-1 flex min-w-0 items-center gap-2", className)}
      data-slot="learn-shell-start"
      {...props}
    >
      {children}
    </div>
  );
}

export function LearnShellEnd({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("col-start-2 row-start-1 flex items-center justify-end gap-1", className)}
      data-slot="learn-shell-end"
      {...props}
    >
      {children}
    </div>
  );
}

export const BAR_ROW_CLASS =
  "mx-auto w-full px-4 pt-3 pb-2 sm:max-w-3xl sm:px-8 lg:mx-0 lg:max-w-none lg:px-10 lg:py-3";

const LEARN_MAIN_ID = "main-content";

export function LearnSkipLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      className="bg-popover text-popover-foreground ring-border focus-visible:ring-ring/50 fixed top-3 left-3 z-50 flex h-10 items-center rounded-lg px-3 text-sm font-medium shadow-[0_8px_24px_-8px_rgb(0_0_0/0.3)] ring-1 outline-none not-focus:sr-only focus-visible:ring-[3px]"
      href={`#${LEARN_MAIN_ID}`}
    >
      {children}
    </a>
  );
}

/** Its padding never depends on the page inside: pages the router keeps hidden stay in the document, so a page with an aside reaches past the padding itself. */
export function LearnShellMain({ children, className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "flex w-full flex-1 flex-col px-4 pt-4 pb-12 outline-none sm:mx-auto sm:max-w-3xl sm:px-8 sm:pt-6 lg:mx-0 lg:max-w-none lg:px-10 lg:pt-8 lg:pb-16",
        className,
      )}
      data-slot="learn-shell-main"
      id={LEARN_MAIN_ID}
      // The skip link moves the keyboard here; Tab goes on from the page's first stop.
      tabIndex={-1}
      {...props}
    >
      {children}
    </main>
  );
}

export function PageWithAside({
  aside,
  asideClassName,
  asideLabel,
  children,
  className,
}: {
  aside?: React.ReactNode;
  asideClassName?: string;
  asideLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className="flex w-full flex-1 flex-col gap-10 min-[72rem]:-mx-10 min-[72rem]:-mt-8 min-[72rem]:-mb-16 min-[72rem]:grid min-[72rem]:w-auto min-[72rem]:grid-cols-[minmax(0,1fr)_auto] min-[72rem]:gap-0"
      data-slot="page-with-aside"
    >
      <div
        className={cn(
          "flex min-w-0 flex-col min-[72rem]:px-10 min-[72rem]:pt-8 min-[72rem]:pb-16",
          className,
        )}
      >
        {children}
      </div>

      {aside && (
        <aside
          aria-label={asideLabel}
          className={cn(
            "flex min-w-0 flex-col gap-8",
            "min-[72rem]:border-border min-[72rem]:sticky min-[72rem]:top-0 min-[72rem]:flex min-[72rem]:h-dvh min-[72rem]:w-[300px] min-[72rem]:overflow-y-auto min-[72rem]:border-l min-[72rem]:px-6 min-[72rem]:py-8 xl:w-80",
            asideClassName,
          )}
          data-slot="page-aside"
        >
          {aside}
        </aside>
      )}
    </div>
  );
}
