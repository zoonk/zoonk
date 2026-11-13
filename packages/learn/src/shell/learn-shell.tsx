import { cn } from "@zoonk/ui/lib/utils";

/** These parts render on the server. */
export function LearnShell({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-background text-foreground flex min-h-dvh flex-col lg:has-[>[data-slot=sidebar]]:flex-row",
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
 * The frame's gutter and bottom room (`--page-gutter`, `--page-bottom`) are set here so the bar over
 * a tab and the page under it share one column. Where the phone's tab bar shows, a bottom bar
 * rests on it (`--page-dock`) and leaves the home indicator's inset to it.
 */
export function LearnShellContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col [--page-bottom:--spacing(12)] [--page-gutter:--spacing(4)] sm:[--page-gutter:--spacing(8)] lg:[--page-bottom:--spacing(16)] lg:[--page-gutter:--spacing(10)]",
        "max-lg:has-data-[slot=learn-bottom-navigation]:[--page-dock:calc(4rem+1px+env(safe-area-inset-bottom))] max-lg:has-data-[slot=learn-bottom-navigation]:[--page-safe-bottom:0px]",
        className,
      )}
      data-slot="learn-shell-content"
      {...props}
    />
  );
}

/** The page's column inside the frame: the bar over a tab and the notices line up with it. */
export const FRAME_COLUMN_CLASS =
  "mx-auto w-full px-(--page-gutter) sm:max-w-3xl lg:mx-0 lg:max-w-none";

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

/**
 * Its padding never depends on the page inside: pages the router keeps hidden stay in the document,
 * so a page with an aside reaches past the padding itself. It has no top padding: the page's bar
 * owns all the room over a title.
 */
export function LearnShellMain({ children, className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        FRAME_COLUMN_CLASS,
        "flex flex-1 flex-col pb-(--page-bottom) outline-none",
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
 * From 72rem the aside runs from the frame's top, beside a tab's bar too (`--frame-bar`), and its
 * first line of words centers on the bar's row (24px over a 20px line: y 34).
 */
export function PageWithAside({
  aside,
  asideClassName,
  asideLabel,
  asideRef,
  bottomBar,
  children,
  className,
}: {
  aside?: React.ReactNode;
  asideClassName?: string;
  asideLabel: string;
  asideRef?: React.Ref<HTMLElement>;
  /**
   * The page's `BottomBar`: last on a phone, after the aside, and from 72rem at the foot of the
   * page's own column, so the aside never covers its main action.
   */
  bottomBar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col gap-7 min-[72rem]:-mx-10 min-[72rem]:-mb-16 min-[72rem]:grid min-[72rem]:w-auto min-[72rem]:grid-cols-[minmax(0,1fr)_auto] min-[72rem]:grid-rows-[1fr_auto] min-[72rem]:gap-0",
        "min-[72rem]:*:data-[slot=bottom-bar]:col-start-1 min-[72rem]:*:data-[slot=bottom-bar]:mx-0 min-[72rem]:*:data-[slot=bottom-bar]:mb-0",
      )}
      data-slot="page-with-aside"
    >
      <div
        className={cn(
          "flex min-w-0 flex-col min-[72rem]:px-10",
          !bottomBar && "min-[72rem]:pb-16",
          className,
        )}
      >
        {children}
      </div>

      {aside && (
        <aside
          aria-label={asideLabel}
          className={cn(
            "flex min-w-0 flex-col gap-7 outline-none min-[72rem]:gap-9",
            "min-[72rem]:border-border min-[72rem]:bg-background min-[72rem]:sticky min-[72rem]:top-0 min-[72rem]:z-30 min-[72rem]:row-span-2 min-[72rem]:-mt-(--frame-bar) min-[72rem]:flex min-[72rem]:h-dvh min-[72rem]:w-[300px] min-[72rem]:overflow-y-auto min-[72rem]:border-l min-[72rem]:px-6 min-[72rem]:pt-6 min-[72rem]:pb-8 xl:w-80",
            asideClassName,
          )}
          data-slot="page-aside"
          ref={asideRef}
          // Focus moves here when a card in it goes away while it holds focus.
          tabIndex={-1}
        >
          {aside}
        </aside>
      )}

      {bottomBar}
    </div>
  );
}
