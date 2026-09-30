import { cn } from "@zoonk/ui/lib/utils";

/**
 * The responsive frame of every learning tab. Mode styling comes from the
 * nearest `data-mode` (see `ModeProvider`), so these parts render on the server:
 * Fun paints deep space and leaves room for the phone dock.
 *
 * ```tsx
 * <LearnShell>
 *   <LearnShellHeader>
 *     <LearnShellStart>{goalSwitcher}</LearnShellStart>
 *     <LearnNavigation activeTab="today" buddy={buddy} />
 *     <LearnShellEnd>{energyAndAccount}</LearnShellEnd>
 *   </LearnShellHeader>
 *   <LearnShellMain>{screen}</LearnShellMain>
 * </LearnShell>
 * ```
 */
export function LearnShell({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-background text-foreground in-data-[mode=fun]:fun-space flex min-h-dvh flex-col",
        className,
      )}
      data-slot="learn-shell"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Phones: start and end on the first row, Focus tabs below. Desktop: one row, tabs centered. Large
 * screens widen the bar: Fun's labeled dock and its three numbers need more room than Focus's
 * tabs and Energy to keep the dock centered in German. Over a `LearnShellMain` column (`column`),
 * tablets keep the bar as wide as that column, so the goal, the tabs and the page share one edge.
 */
export function LearnShellHeader({
  children,
  className,
  column = false,
  ...props
}: React.ComponentProps<"header"> & { column?: boolean }) {
  return (
    <header
      className={cn(
        "mx-auto grid w-full max-w-5xl grid-cols-[1fr_auto] items-center gap-x-2 gap-y-3 px-4 pt-3 pb-2 lg:grid-cols-[1fr_auto_1fr] lg:px-6 lg:py-4 xl:max-w-6xl xl:in-data-[mode=fun]:max-w-7xl",
        column && "sm:max-w-150 lg:max-w-5xl xl:max-w-6xl xl:in-data-[mode=fun]:max-w-7xl",
        className,
      )}
      data-slot="learn-shell-header"
      {...props}
    >
      {children}
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

/** Where Energy, Brain Power and the account live. */
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

/** One centered 600px column with one next step. */
export function LearnShellMain({ children, className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-150 flex-1 flex-col px-4 pt-4 pb-12 in-data-[mode=fun]:pb-32 lg:pt-6 lg:in-data-[mode=fun]:pb-12",
        className,
      )}
      data-slot="learn-shell-main"
      {...props}
    >
      {children}
    </main>
  );
}
