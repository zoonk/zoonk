import { cn } from "@zoonk/ui/lib/utils";

/**
 * The responsive frame of every learning tab. These parts render on the server.
 *
 * ```tsx
 * <LearnShell>
 *   <LearnShellHeader sticky>
 *     <LearnShellStart>{goalSwitcher}</LearnShellStart>
 *     <LearnTopNavigation activeTab="today" buddy={buddy} />
 *     <LearnShellEnd>{account}</LearnShellEnd>
 *   </LearnShellHeader>
 *   <LearnShellMain>{screen}</LearnShellMain>
 *   <LearnBottomNavigation activeTab="today" buddy={buddy} />
 * </LearnShell>
 * ```
 */
export function LearnShell({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-background text-foreground flex min-h-dvh flex-col", className)}
      data-slot="learn-shell"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * One row at every width, over the 600px column on phones and tablets so the goal, the account and
 * the page share one edge. From `lg` the tabs sit in its center (`LearnTopNavigation`) and, with
 * `sticky`, the bar stays at the top while the page scrolls; under `lg` the tabs are at the bottom.
 */
export function LearnShellHeader({
  children,
  className,
  sticky = false,
  ...props
}: React.ComponentProps<"header"> & { sticky?: boolean }) {
  return (
    <header
      className={cn(sticky && "lg:bg-background lg:sticky lg:top-0 lg:z-30", className)}
      data-slot="learn-shell-header"
      {...props}
    >
      <div className="mx-auto grid w-full max-w-150 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 pt-3 pb-2 lg:max-w-5xl lg:grid-cols-[1fr_auto_1fr] lg:px-6 lg:py-3">
        {children}
      </div>
    </header>
  );
}

/** Where the goal switcher lives. */
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

/** Where the account lives. */
export function LearnShellEnd({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "col-start-2 row-start-1 flex items-center justify-end gap-2 lg:col-start-3",
        className,
      )}
      data-slot="learn-shell-end"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * A page wider than the column (the Journey's two columns, a detail page's identity beside its
 * sections): as wide as the bar's content from `lg`, so the page and the bar share their edges.
 */
export const WIDE_PAGE_CLASS = "lg:w-[min(calc(100vw-3rem),61rem)] lg:self-center";

/** One centered 600px column with one next step. */
export function LearnShellMain({ children, className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-150 flex-1 flex-col px-4 pt-4 pb-12 lg:pt-6",
        className,
      )}
      data-slot="learn-shell-main"
      {...props}
    >
      {children}
    </main>
  );
}
