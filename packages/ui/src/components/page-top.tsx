"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { useScrolled } from "@zoonk/ui/hooks/scrolled";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { buttonVariants } from "./button";
import { PAGE_HEADER_CLASS } from "./page-header-class";

const BACK_LINK_CLASS = cn(
  buttonVariants({ edge: "start", size: "sm", variant: "ghost" }),
  // Rounded down, the chevron's ink lands about a pixel inside the title's first letter on a phone.
  "min-w-0 shrink [--edge-start-round:up]",
);

/**
 * The way back from a page: a chevron and the name of the page it goes back to, the mirror of a
 * "See all" row's label and chevron, so both keep one gap. `render` is the app's own link, and
 * `aria-label` says "Back to …" in the reader's language.
 */
function BackLink({
  children,
  render,
  tone = "muted",
  ...props
}: Omit<useRender.ComponentProps<"a">, "className"> & {
  "aria-label": string;
  tone?: "foreground" | "muted";
}) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          BACK_LINK_CLASS,
          tone === "foreground" ? "text-foreground" : "text-muted-foreground",
        ),
      },
      props,
      {
        children: (
          <>
            <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />
            <span className="truncate">{children}</span>
          </>
        ),
      },
    ),
    render,
    state: { slot: "back-link" },
  });
}

/**
 * The bar's row: the way back at the start, the actions at the end and, between them, what the
 * whole screen shares (a step counter), up to 6rem wide (8rem from `sm`), which it fills. The middle
 * is centered while both ends leave it room and narrows when they don't, so a long translated label
 * never covers it. Too narrow to read, it's left to screen readers, as a native bar drops its title.
 */
function PageTopRow({
  actions,
  back,
  className,
  middle,
}: {
  actions?: React.ReactNode;
  back?: React.ReactNode;
  className?: string;
  middle?: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2", className)}>
      <div
        className={cn(
          "flex grow basis-0 items-center gap-3",
          middle ? "min-w-max" : "min-w-(--bar-start-min,0px)",
        )}
        data-slot="page-top-start"
      >
        {back}
      </div>

      {middle && (
        <div className="@container pointer-events-none flex max-w-24 min-w-0 grow basis-0 sm:max-w-32">
          <div className="flex w-full @max-[2.5rem]:sr-only">{middle}</div>
        </div>
      )}

      <div
        className={cn(
          "ms-auto flex shrink-0 items-center justify-end gap-2",
          middle && "grow basis-0",
        )}
        data-slot="page-top-end"
      >
        {actions}
      </div>
    </div>
  );
}

/**
 * The bar over a page's title: its way back at the start, its actions at the end. With the header
 * under it (`PAGE_HEADER_CLASS`) it owns all the room above the title: its row is the frame's first
 * row, 12px from the top, and the title sits under it. It sticks while the page scrolls and reaches
 * the frame's edges by the frame's own side padding (`--page-gutter`); the frame has no top padding.
 * `className` is for a frame whose bar holds nothing in some state (on a computer, where a sidebar
 * holds the way back): `static pb-0 *:hidden` then leaves only its top room and hairline (13px),
 * so the title takes the bar's row and centers on it instead of sitting under an empty bar.
 * A bar whose start must stay readable sets `--bar-start-min`: when large text leaves the start less
 * than that, the actions move to a line of their own under it.
 */
function PageTopBar({
  actions,
  back,
  className,
  middle,
  ref,
}: {
  /** The page's own actions, at the bar's end, 8px apart: `Button size="bar"`, or `"icon-bar"` for a glyph alone. */
  actions?: React.ReactNode;
  /** A `BackLink` to the parent page; a page with no parent has none. */
  back?: React.ReactNode;
  className?: string;
  middle?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const scrolled = useScrolled();

  return (
    <div
      className={cn(
        "bg-background sticky top-0 z-30 -mx-(--page-gutter) border-b px-(--page-gutter) pt-3 pb-2 transition-colors motion-reduce:transition-none",
        scrolled ? "border-border" : "border-transparent",
        className,
      )}
      data-slot="page-top-bar"
      ref={ref}
    >
      <PageTopRow actions={actions} back={back} middle={middle} />
    </div>
  );
}

/**
 * A page's whole top, for a page that draws both parts itself. Where a layout draws the bar and
 * the page its title, as in the app's shell, they use `PageTopBar` and `PAGE_HEADER_CLASS`.
 */
function PageTop({
  children,
  ...bar
}: React.ComponentProps<typeof PageTopBar> & { children: React.ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-col" data-slot="page-top">
      <PageTopBar {...bar} />
      <header className={PAGE_HEADER_CLASS} data-slot="page-header">
        {children}
      </header>
    </div>
  );
}

const TITLE_CLASS = {
  headline: "text-headline",
  title:
    "text-title supports-[text-box:cap_alphabetic]:min-h-[2.125rem] supports-[text-box:cap_alphabetic]:py-[calc((2.125rem-1cap)/2)] supports-[text-box:cap_alphabetic]:[text-box:trim-both_cap_alphabetic]",
} as const;

/**
 * A page's title, in one of two type roles. The back link over it lines up with its first letter,
 * so the role also moves the link (`[data-slot="page-top-bar"]` in `globals.css`).
 */
function PageTitle({
  children,
  className,
  variant = "title",
  ...props
}: React.ComponentProps<"h1"> & { variant?: keyof typeof TITLE_CLASS }) {
  return (
    <h1
      className={cn("text-balance", TITLE_CLASS[variant], className)}
      data-slot="page-title"
      data-title={variant}
      {...props}
    >
      {children}
    </h1>
  );
}

export { BackLink, PageTitle, PageTop, PageTopBar, PageTopRow };
