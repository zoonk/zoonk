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
  "text-muted-foreground min-w-0 shrink",
);

/**
 * The way back from a page: a chevron and the name of the page it goes back to, the mirror of a
 * "See all" row's label and chevron, so both keep one gap. `render` is the app's own link, and
 * `aria-label` says "Back to …" in the reader's language.
 */
function BackLink({
  children,
  render,
  ...props
}: Omit<useRender.ComponentProps<"a">, "className"> & { "aria-label": string }) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">({ className: BACK_LINK_CLASS }, props, {
      children: (
        <>
          <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />
          <span className="truncate">{children}</span>
        </>
      ),
    }),
    render,
    state: { slot: "back-link" },
  });
}

/**
 * The bar over a page's title: its way back at the start, its actions at the end. With the header
 * under it (`PAGE_HEADER_CLASS`) it owns all the room above the title, so every page's title sits at one height, on a phone and a
 * computer, whether or not the bar holds anything. It sticks while the page scrolls and reaches the
 * frame's edges by the frame's own side padding (`--page-gutter`); the frame has no top padding.
 */
function PageTopBar({
  actions,
  back,
  ref,
}: {
  /** The page's own actions, at the bar's end, 8px apart: `Button size="bar"`, or `"icon-bar"` for a glyph alone. */
  actions?: React.ReactNode;
  /** A `BackLink` to the parent page; a page with no parent has none. */
  back?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const scrolled = useScrolled();

  return (
    <div
      className={cn(
        "bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-30 -mx-(--page-gutter) border-b px-(--page-gutter) pt-3 pb-2 backdrop-blur transition-colors motion-reduce:transition-none",
        scrolled ? "border-border" : "border-transparent",
      )}
      data-slot="page-top-bar"
      ref={ref}
    >
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3" data-slot="page-top-start">
          {back}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2" data-slot="page-top-end">
          {actions}
        </div>
      </div>
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

const TITLE_CLASS = { headline: "text-headline", title: "text-title" } as const;

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
      className={cn(TITLE_CLASS[variant], className)}
      data-slot="page-title"
      data-title={variant}
      {...props}
    >
      {children}
    </h1>
  );
}

export { BackLink, PageTitle, PageTop, PageTopBar };
