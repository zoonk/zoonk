"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { useScrolled } from "@zoonk/ui/hooks/scrolled";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PAGE_COLUMN_CLASS } from "../_components/page";
import { LearnLink } from "../learn-link";
import { cameFromApp, goBackTo, goBackToApp, subscribeToHistory } from "./app-history";
import { BAR_ROW_CLASS } from "./learn-shell";

/** The bar's height, under which a page's title counts as scrolled away. */
const BAR_HEIGHT_PX = 64;

const BAR_SURFACE_CLASS =
  "bg-background/95 supports-backdrop-filter:bg-background/80 border-b backdrop-blur transition-colors motion-reduce:transition-none";

/**
 * A page bar's surface: sticky at the page's top over the frame's padding, as wide as the page's
 * edges, its hairline drawn once the page scrolls. `children` is the bar's row, on the page's
 * measure (`LearnPageBar`'s, or an onboarding screen's narrower column).
 */
export function PageBarSurface({ children, className, ...props }: React.ComponentProps<"div">) {
  const scrolled = useScrolled();

  return (
    <div
      className={cn(
        BAR_SURFACE_CLASS,
        "sticky top-0 z-30 -mx-4 -mt-4 sm:-mx-8 sm:-mt-6 lg:-mx-10 lg:-mt-8",
        scrolled ? "border-border" : "border-transparent",
        className,
      )}
      data-slot="learn-page-bar"
      {...props}
    >
      <div className="w-full px-4 pt-3 pb-2 sm:px-8 lg:px-10 lg:py-3">{children}</div>
    </div>
  );
}

/**
 * Whether the page's own title (its first `h1`, next to the bar) has scrolled under the bar, so
 * the bar takes its name, as native apps do.
 */
function useTitleScrolledAway(bar: React.RefObject<HTMLElement | null>) {
  const [away, setAway] = useState(false);

  useEffect(() => {
    const heading = bar.current?.parentElement?.querySelector("h1");

    if (!heading) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) =>
        setAway(
          Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.top < BAR_HEIGHT_PX),
        ),
      { rootMargin: `-${BAR_HEIGHT_PX}px 0px 0px 0px` },
    );

    observer.observe(heading);
    return () => observer.disconnect();
  }, [bar]);

  return away;
}

const BAR_ICON_LINK_CLASS = cn(
  buttonVariants({ size: "icon-bar", variant: "ghost" }),
  "[&_svg:not([class*='size-'])]:size-5",
);

/**
 * A page's way back: a 44px chevron under `lg`; from `lg` the breadcrumb's first step ("‹ Plan",
 * onboarding's "‹ Back"), its chevron pulled onto the page's edge, so the bar starts where the
 * page's title does.
 */
export const CRUMB_LINK_CLASS =
  "text-foreground hover:bg-muted lg:text-muted-foreground lg:hover:text-foreground focus-visible:ring-ring/50 hit-area relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-[3px] [&_svg]:size-5 lg:-ml-1.5 lg:h-8 lg:w-auto lg:gap-0.5 lg:pr-1 lg:text-[0.8125rem] lg:hover:bg-transparent lg:[&_svg]:size-4";

/** The way back's name: where it leads, or simply "Back". */
function BackLinkName({ label }: { label?: string }) {
  const t = useExtracted();
  return label ? t("Back to {page}", { page: label }) : t("Back");
}

/**
 * The way back, on the left of a page's or a section's bar: a chevron, named for where it leads.
 * A page goes back to the page it was opened from (the same page as before, scroll and all, when
 * that's where the learner came from); a section goes back to the app page the learner left for
 * it (`toApp`). Escape presses it too, unless a menu, dialog or field has the key. A page's way
 * back is a breadcrumb from `lg` (`crumb`), with its destination's name beside the chevron. A
 * flow whose chevron means its previous screen leaves with an ✕ instead (`leave`), named "Leave"
 * as a task's close is, so going back and going out never look alike.
 */
export function LearnBackLink({
  className,
  crumb = false,
  href,
  label,
  leave = false,
  toApp = false,
}: {
  className?: string;
  crumb?: boolean;
  /** Where it leads when the browser can't go back there itself. */
  href: string;
  /** The destination's name, for its accessible name; a section's way back has none. */
  label?: string;
  leave?: boolean;
  toApp?: boolean;
}) {
  const t = useExtracted();
  const ref = useEscapeClick<HTMLAnchorElement>();

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    if (!isPlainClick) {
      return;
    }

    const wentBack = toApp ? goBackToApp() : goBackTo(event.currentTarget.href);

    if (wentBack) {
      event.preventDefault();
    }
  };

  return (
    <LearnLink
      className={cn(crumb ? CRUMB_LINK_CLASS : BAR_ICON_LINK_CLASS, className)}
      href={href}
      onClick={onClick}
      ref={ref}
    >
      {leave ? <XIcon aria-hidden="true" /> : <ChevronLeftIcon aria-hidden="true" />}
      <span className="sr-only">{leave ? t("Leave") : <BackLinkName label={label} />}</span>
      {crumb && label && (
        <span aria-hidden="true" className="hidden lg:inline">
          {label}
        </span>
      )}
    </LearnLink>
  );
}

/**
 * Where the page sits, from `lg`: its parent (the way back) and its own name, "‹ Plan /
 * Linguagens". Under `lg` the chevron is alone, and the page's name joins it once its title has
 * scrolled away, on up to two lines beside the bar's actions (a visitor's Pricing and Log in left a
 * course's name at "Física quâ…"). A page the sidebar lists (`root`) has neither from `lg`, where the sidebar says
 * where it is; its chevron returns to the app page the learner came from.
 */
function PageBarStart({
  back,
  root = false,
  title,
  titleAway,
}: {
  back: { href: string; label?: string };
  root?: boolean;
  title?: string;
  titleAway: boolean;
}) {
  return (
    <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 lg:gap-1.5">
      {root ? (
        <LearnBackLink className="lg:hidden" href={back.href} toApp />
      ) : (
        <LearnBackLink crumb href={back.href} label={back.label} />
      )}

      {title && !root && (
        <span
          aria-hidden="true"
          className="hidden min-w-0 items-center gap-1.5 text-[0.8125rem] lg:flex"
        >
          <span className="text-faint before:content-['/']" />
          <span className="truncate font-medium">{title}</span>
        </span>
      )}

      {title && titleAway && (
        <span
          aria-hidden="true"
          className="motion-safe:animate-in motion-safe:fade-in line-clamp-2 min-w-0 text-sm leading-tight font-semibold text-pretty duration-200 lg:hidden"
        >
          {title}
        </span>
      )}
    </div>
  );
}

/**
 * The bar of a page opened from a tab (a chapter, a subject, the exam, the mistakes notebook): it
 * takes the app bar's place under `lg`, with the way back on the left and the page's own actions on
 * the right; from `lg` it sits over the page beside the sidebar, which keeps the tabs, and the way
 * back is a breadcrumb with the page's name ("‹ Plan / Linguagens"). The page's title (its `h1`)
 * stays in the page; under `lg`, once it scrolls under the bar, the bar shows it. Place it first in
 * the page, beside the `h1`'s section, so it stays at the top while the page scrolls.
 *
 * ```tsx
 * <div className="flex flex-col gap-6">
 *   <LearnPageBar back={{ href: "/plan", label: t("Plan") }} title={chapter.title}>
 *     <ChapterMenu />
 *   </LearnPageBar>
 *   <header><h1>{chapter.title}</h1></header>
 * </div>
 * ```
 */
export function LearnPageBar({
  back,
  children,
  root = false,
  title,
}: {
  /** Where the way back leads and its name; a `root` page's needs no name (see `root`). */
  back: { href: string; label?: string };
  /** The page's actions, as icon buttons. */
  children?: React.ReactNode;
  /**
   * A page the sidebar lists from `lg` (the mistakes notebook, the exam, mind maps, speaking): the
   * sidebar says where it is, so from `lg` the bar has no way back (and doesn't show without
   * actions). Its way back under `lg`, and Escape, return to the app page the learner came from,
   * whichever it was: `back.href` without one.
   */
  root?: boolean;
  /** The page's title, shown in the bar once its `h1` scrolls away. */
  title?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleAway = useTitleScrolledAway(ref);

  return (
    <PageBarSurface className={cn(root && !children && "lg:hidden")} ref={ref}>
      {/* As tall as an action's button even without one (a lesson's page has no "…"), so every
          page's bar, and the skeletons drawn to it, share one height. */}
      {/* `data-title-away` lets an action give way to the page's name on a phone (a visitor's
          Pricing, `group-data-title-away/page-bar`). */}
      <div
        className={cn(
          PAGE_COLUMN_CLASS,
          "group/page-bar grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 lg:min-h-10",
        )}
        data-title-away={(title && titleAway) || undefined}
      >
        <PageBarStart back={back} root={root} title={title} titleAway={titleAway} />

        <div className="col-start-2 row-start-1 flex items-center justify-end gap-1">
          {children}
        </div>
      </div>
    </PageBarSurface>
  );
}

/**
 * The bar of a section (settings, statistics) under `lg`, where it replaces the app's bars while
 * the learner is in it: the way back on the left, one action of the section's on the right. On the
 * section's own first page (its hub) the way back leaves the section for the app page the learner
 * left for it; on the pages under it (`parent`) it goes back to the hub, whose name it shows beside
 * it, unless the page was opened straight from the app (Plus from a locked feature), which it goes
 * back to.
 */
export function LearnSectionBar({
  backHref,
  className,
  end,
  parent,
  title,
}: {
  /** Where the way back leads when there's no app page to return to. */
  backHref: string;
  /** Its place in the page, such as bleeding to the column's edges. */
  className?: string;
  end?: React.ReactNode;
  /** The section's hub, for a page under it: the way back leads there and the bar names it. */
  parent?: { href: string; label: string };
  /**
   * On the hub itself, its name beside the way back from `lg`, where its first page sits beside the
   * sidebar instead of its large title.
   */
  title?: string;
}) {
  const scrolled = useScrolled();

  return (
    <header
      className={cn(
        BAR_SURFACE_CLASS,
        "sticky top-0 z-30",
        scrolled ? "border-border" : "border-transparent",
        className,
      )}
      data-slot="learn-section-bar"
    >
      <div className={cn("flex items-center justify-between gap-3", BAR_ROW_CLASS)}>
        <div className="flex min-w-0 items-center gap-3">
          <SectionBarStart backHref={backHref} parent={parent} title={title} />
        </div>

        <div className="flex items-center justify-end gap-2">{end}</div>
      </div>
    </header>
  );
}

function SectionBarStart({
  backHref,
  parent,
  title,
}: {
  backHref: string;
  parent?: { href: string; label: string };
  title?: string;
}) {
  // Read after hydration: the server has no history, and its render goes to the hub.
  const fromApp = useSyncExternalStore(subscribeToHistory, cameFromApp, () => false);

  // A page under the hub opened straight from the app goes back to that app page.
  if (!parent || fromApp) {
    return (
      <>
        <LearnBackLink href={backHref} toApp />
        {title && (
          <span
            aria-hidden="true"
            className="hidden min-w-0 truncate text-sm font-medium lg:inline"
          >
            {title}
          </span>
        )}
      </>
    );
  }

  return (
    <>
      <LearnBackLink href={parent.href} label={parent.label} />
      <span aria-hidden="true" className="min-w-0 truncate text-sm font-medium">
        {parent.label}
      </span>
    </>
  );
}

export { markAppEntry } from "./app-history";
