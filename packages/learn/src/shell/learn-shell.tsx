import { cn } from "@zoonk/ui/lib/utils";

/**
 * The responsive frame of every learning tab. These parts render on the server.
 *
 * From `lg` the app's navigation is a sidebar on the left (the goal, search, the tabs, the study
 * shortcuts and the account) with the page beside it; under `lg` the sidebar is hidden and a top
 * bar (goal and account) and a tab bar at the bottom take its place.
 *
 * ```tsx
 * <LearnShell>
 *   <LearnSidebar>
 *     <LearnSidebarHeader>{goalSwitcher}{search}</LearnSidebarHeader>
 *     <LearnSideNavigation activeTab="today" buddy={buddy} />
 *     <LearnSidebarFooter>{account}</LearnSidebarFooter>
 *   </LearnSidebar>
 *   <LearnShellContent>
 *     <LearnShellHeader className="lg:hidden">
 *       <LearnShellStart>{goalSwitcher}</LearnShellStart>
 *       <LearnShellEnd>{account}</LearnShellEnd>
 *     </LearnShellHeader>
 *     <LearnShellMain>{screen}</LearnShellMain>
 *     <LearnBottomNavigation activeTab="today" buddy={buddy} />
 *   </LearnShellContent>
 * </LearnShell>
 * ```
 */
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

/** The sidebar's width from `lg`, which wide pages and the page bar leave out of the viewport. */
const SIDEBAR_WIDTH_CLASS = "w-60";

/**
 * The app's navigation from `lg`, as Linear lays it out: quiet, on the left, the page's work in
 * front. Hidden under `lg`, where the top bar and the bottom tab bar take its place.
 */
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

/** The sidebar's top: the goal switcher and search. */
export function LearnSidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="learn-sidebar-header"
      {...props}
    />
  );
}

/** A group of the sidebar's links, named by a quiet label when it has one. */
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

/**
 * One link of the sidebar: its icon, its name and a quiet count or mark at its end. Rows are 32px
 * at 13.5px as Linear has them; `hit-area` keeps each one 44px to tap.
 */
export const LEARN_SIDEBAR_ITEM_CLASS =
  "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-foreground focus-visible:ring-ring/50 hit-area press relative flex h-8 min-w-0 items-center gap-2.5 rounded-md px-2 text-[0.84375rem] font-medium outline-none focus-visible:ring-[3px] [&>svg]:size-4 [&>svg]:shrink-0";

/** The sidebar's end: the learner's account and level. */
export function LearnSidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex items-center gap-2 pt-2", className)}
      data-slot="learn-sidebar-footer"
      {...props}
    />
  );
}

/** Everything beside the sidebar: the top bar under `lg`, the page and the bottom tab bar. */
export function LearnShellContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col", className)}
      data-slot="learn-shell-content"
      {...props}
    />
  );
}

/**
 * One row over the page's column, so the goal, the account and the page share one edge. The
 * learning tabs hide it from `lg`, where the sidebar has the goal and the account. Its row is as
 * tall as every bar's (a touch target, as a page's or a section's bar), whether it holds the
 * learner's 36px goal and level or a visitor's "Log in", so the page under it starts at one height.
 */
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
      className={cn("col-start-2 row-start-1 flex items-center justify-end gap-1", className)}
      data-slot="learn-shell-end"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * The row of a bar over the page (the top bar, a page's or a section's bar), on the page's own
 * edges: the phone's gutters, a centered 48rem column on a tablet, and the page's 40px from `lg`.
 */
export const BAR_ROW_CLASS =
  "mx-auto w-full px-4 pt-3 pb-2 sm:max-w-3xl sm:px-8 lg:mx-0 lg:max-w-none lg:px-10 lg:py-3";

/** The page's region, where the frame's skip link (`LearnSkipLink`) takes the keyboard. */
const LEARN_MAIN_ID = "main-content";

/**
 * The frame's first stop for the keyboard: a link past the sidebar's (or the bars') many stops
 * straight to the page, out of sight until it has focus. `children` is its translated label.
 */
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

/**
 * The page's frame. On phones, the full width with 16px gutters; on a tablet, one centered 48rem
 * column, as wide as its bars; from `lg`, the whole room beside the sidebar inside 40px gutters,
 * which the page fills from its left edge (`PAGE_COLUMN_CLASS`), so every page's title sits at the
 * same place and a wide screen gives the page more room rather than a wider margin.
 * Its padding never depends on the page inside: pages the router keeps hidden for going back stay
 * in the document, so a page with an aside (`PageWithAside`) reaches past the padding itself.
 */
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

/**
 * A page with an aside beside it (Today's week and readiness, the Plan's numbers and settings, a
 * subject's properties), as v2's desktop draws it: from 72rem the page fills the room between the
 * sidebar and the aside, which runs the screen's full height at its right edge, behind a hairline,
 * scrolling on its own: the page reaches past the frame's padding (its negative margins) and puts
 * it back on its own column. Under 72rem the aside's blocks follow the page in the same column
 * (`asideClassName` lays them out there, such as two up on a tablet).
 *
 * ```tsx
 * <PageWithAside aside={<WeekBlock />} asideLabel={t("Your week")}>
 *   <Page>…</Page>
 * </PageWithAside>
 * ```
 */
export function PageWithAside({
  aside,
  asideClassName,
  asideLabel,
  children,
  className,
}: {
  aside?: React.ReactNode;
  asideClassName?: string;
  /** The aside's accessible name. */
  asideLabel: string;
  children: React.ReactNode;
  /** The page's column, such as `flex-1` for a chat whose composer sits at the screen's bottom. */
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
