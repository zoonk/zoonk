import { FRAME_GUTTER_CLASS } from "@zoonk/ui/components/bottom-bar";
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
        "flex min-w-0 flex-1 flex-col [--page-bottom:--spacing(12)] lg:[--page-bottom:--spacing(16)]",
        FRAME_GUTTER_CLASS,
        "max-lg:has-data-[slot=learn-bottom-navigation]:[--page-dock:calc(4rem+1px+env(safe-area-inset-bottom))] max-lg:has-data-[slot=learn-bottom-navigation]:[--page-safe-bottom:0px]",
        className,
      )}
      data-slot="learn-shell-content"
      {...props}
    />
  );
}

/**
 * Where a page's way back leads nowhere the frame doesn't already show, so the bar doesn't draw it:
 * `back` hides the link, and `bare` lets a bar that then holds nothing keep only its top room and
 * hairline and scroll away, so the title takes the bar's row (`PageTopBar`'s `className`). A bar
 * holds nothing when its end shows nothing: no actions, or on a computer only a phone's
 * (`data-phone-only`). `data-signed-in` says whose frame this is before the first paint.
 * - `computer`: from `lg`, where the sidebar holds the goal and every page it lists.
 * - `learner`, `visitor`: from `lg`, a page the sidebar lists in that state.
 * - `tabs`: a page whose way back is Today, the Plan or the buddy, for a learner, who reaches them by
 *   the tab bar under `lg` and the sidebar from it. A visitor has neither and keeps the link.
 * - `sectionTabs`: from `md`, where a section's own tabs lead to its first page.
 */
export const NO_WAY_BACK = {
  computer: {
    back: "lg:hidden",
    bare: "lg:not-has-[[data-slot=page-top-end]>:not([data-phone-only])]:static lg:not-has-[[data-slot=page-top-end]>:not([data-phone-only])]:pb-0 lg:not-has-[[data-slot=page-top-end]>:not([data-phone-only])]:*:hidden",
  },
  learner: {
    back: "lg:[[data-signed-in]_&]:hidden",
    bare: "lg:[[data-signed-in]_&]:not-has-[[data-slot=page-top-end]>:not([data-phone-only])]:static lg:[[data-signed-in]_&]:not-has-[[data-slot=page-top-end]>:not([data-phone-only])]:pb-0 lg:[[data-signed-in]_&]:not-has-[[data-slot=page-top-end]>:not([data-phone-only])]:*:hidden",
  },
  sectionTabs: {
    back: "md:hidden",
    bare: "md:not-has-[[data-slot=page-top-end]>*]:static md:not-has-[[data-slot=page-top-end]>*]:pb-0 md:not-has-[[data-slot=page-top-end]>*]:*:hidden",
  },
  tabs: {
    back: "[[data-signed-in]_&]:hidden",
    bare: "[[data-signed-in]_&]:not-has-[[data-slot=page-top-end]>*]:static [[data-signed-in]_&]:not-has-[[data-slot=page-top-end]>*]:pb-0 [[data-signed-in]_&]:not-has-[[data-slot=page-top-end]>*]:*:hidden",
  },
  visitor: {
    back: "lg:[:root:not([data-signed-in])_&]:hidden",
    bare: "lg:[:root:not([data-signed-in])_&]:not-has-[[data-slot=page-top-end]>:not([data-phone-only])]:static lg:[:root:not([data-signed-in])_&]:not-has-[[data-slot=page-top-end]>:not([data-phone-only])]:pb-0 lg:[:root:not([data-signed-in])_&]:not-has-[[data-slot=page-top-end]>:not([data-phone-only])]:*:hidden",
  },
} as const;

export type NoWayBack = keyof typeof NO_WAY_BACK;

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
 * The bottom bar ends the main column, so it pins over that column and never covers the aside.
 * Under 72rem the column dissolves into the page and the bar comes after the aside, so it stays
 * pinned while the aside scrolls by; on a short page it rests on the frame's bottom.
 */
const WITH_BAR_COLUMN_CLASS =
  "max-[72rem]:contents [&>[data-slot=bottom-bar]]:mt-auto max-[72rem]:[&>[data-slot=bottom-bar]]:order-last";

/**
 * At desktop widths the aside's first card starts on the frame's first row, 12px from the top, level
 * with the sidebar's first row and the page's bar or title, wherever in its column the page draws
 * them. `bottomBar` is the page's `BottomBar`.
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
  bottomBar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className="group/page-aside flex w-full flex-1 flex-col gap-7 min-[72rem]:-mx-(--page-gutter) min-[72rem]:-mb-16 min-[72rem]:grid min-[72rem]:w-auto min-[72rem]:grid-cols-[minmax(0,1fr)_auto] min-[72rem]:gap-0"
      data-slot="page-with-aside"
    >
      <div
        className={cn(
          "flex min-w-0 flex-col min-[72rem]:px-(--page-gutter) min-[72rem]:pb-16",
          bottomBar && WITH_BAR_COLUMN_CLASS,
          className,
        )}
      >
        {children}
        {bottomBar}
      </div>

      {aside && (
        <aside
          aria-label={asideLabel}
          className={cn(
            "flex min-w-0 flex-col gap-7 outline-none min-[72rem]:gap-9",
            "min-[72rem]:border-border min-[72rem]:bg-background min-[72rem]:sticky min-[72rem]:top-0 min-[72rem]:z-30 min-[72rem]:-mt-(--frame-bar) min-[72rem]:flex min-[72rem]:h-dvh min-[72rem]:w-[300px] min-[72rem]:overflow-y-auto min-[72rem]:border-l min-[72rem]:px-6 min-[72rem]:pt-3 min-[72rem]:pb-8 xl:w-80",
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
    </div>
  );
}
