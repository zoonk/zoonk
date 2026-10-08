"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon, HouseIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { createContext, use, useEffect, useRef, useState } from "react";
import { LearnLink } from "../learn-link";
import { goBackTo, goBackToApp } from "./app-history";

/**
 * The app's tabs as the host draws them, so a pushed page's bar keeps them in its middle from
 * `lg`, where the app bar has them. Under `lg` the tab bar at the bottom stays.
 */
const LearnBarTabsContext = createContext<React.ReactNode>(null);

export function LearnBarProvider({
  children,
  tabs,
}: {
  children: React.ReactNode;
  tabs: React.ReactNode;
}) {
  return <LearnBarTabsContext value={tabs}>{children}</LearnBarTabsContext>;
}

/** The bar's height, under which a page's title counts as scrolled away. */
const BAR_HEIGHT_PX = 64;

const BAR_SURFACE_CLASS =
  "bg-background/95 supports-backdrop-filter:bg-background/80 border-b backdrop-blur transition-colors motion-reduce:transition-none";

/** Whether the page has scrolled at all, which draws the bar's bottom edge. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(globalThis.scrollY > 0);
    update();
    globalThis.addEventListener("scroll", update, { passive: true });
    return () => globalThis.removeEventListener("scroll", update);
  }, []);

  return scrolled;
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
  buttonVariants({ size: "icon-bar", variant: "outline" }),
  "rounded-full [&_svg:not([class*='size-'])]:size-5",
);

/**
 * The way back, on the left of a page's or a section's bar: a chevron, named for where it leads.
 * A page goes back to the page it was opened from (the same page as before, scroll and all, when
 * that's where the learner came from); a section goes back to the app page the learner left for
 * it (`toApp`). Escape presses it too, unless a menu, dialog or field has the key.
 */
function LearnBackLink({
  href,
  label,
  toApp = false,
}: {
  /** Where it leads when the browser can't go back there itself. */
  href: string;
  /** The destination's name, for its accessible name; a section's way back has none. */
  label?: string;
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
    <LearnLink className={BAR_ICON_LINK_CLASS} href={href} onClick={onClick} ref={ref}>
      <ChevronLeftIcon aria-hidden="true" />
      <span className="sr-only">{label ? t("Back to {page}", { page: label }) : t("Back")}</span>
    </LearnLink>
  );
}

/**
 * The way home, on the left of a section that sits beside the app rather than inside it (the
 * course catalog): Today for a learner, the home page for a visitor. Escape presses it too, like
 * the other sections' way back.
 */
function LearnHomeLink({ href }: { href: string }) {
  const t = useExtracted();
  const ref = useEscapeClick<HTMLAnchorElement>();

  return (
    <LearnLink className={BAR_ICON_LINK_CLASS} href={href} ref={ref}>
      <HouseIcon aria-hidden="true" />
      <span className="sr-only">{t("Home")}</span>
    </LearnLink>
  );
}

/**
 * The bar of a page opened from a tab (a chapter, a subject, the exam, the mistakes notebook): it
 * takes the app bar's place, with the way back on the left, the page's own actions on the right
 * and, from `lg`, the app's tabs in the middle. The page's title (its `h1`) stays in the page; once
 * it scrolls under the bar, the bar shows it. Place it first in the page, beside the `h1`'s
 * section, so it stays at the top while the page scrolls.
 *
 * ```tsx
 * <div className="flex flex-col gap-6">
 *   <LearnPageBar back={{ href: "/journey", label: t("Journey") }} title={chapter.title}>
 *     <ChapterMenu />
 *   </LearnPageBar>
 *   <header><h1>{chapter.title}</h1></header>
 * </div>
 * ```
 */
export function LearnPageBar({
  back,
  children,
  title,
}: {
  back: { href: string; label: string };
  /** The page's actions, as icon buttons. */
  children?: React.ReactNode;
  /** The page's title, shown in the bar once its `h1` scrolls away. */
  title?: string;
}) {
  const tabs = use(LearnBarTabsContext);
  const ref = useRef<HTMLDivElement>(null);
  const scrolled = useScrolled();
  const titleAway = useTitleScrolledAway(ref);

  return (
    <div
      className={cn(
        BAR_SURFACE_CLASS,
        "sticky top-0 z-30 -mx-4 -mt-4 lg:mx-[calc((100%-min(100vw,64rem))/2)] lg:-mt-6",
        scrolled ? "border-border" : "border-transparent",
      )}
      data-slot="learn-page-bar"
      ref={ref}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 pt-3 pb-2 lg:grid-cols-[1fr_auto_1fr] lg:px-6 lg:py-3">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
          <LearnBackLink href={back.href} label={back.label} />
          {title && titleAway && (
            <span
              aria-hidden="true"
              className="motion-safe:animate-in motion-safe:fade-in min-w-0 truncate font-semibold duration-200"
            >
              {title}
            </span>
          )}
        </div>

        {tabs}

        <div className="col-start-2 row-start-1 flex items-center justify-end gap-1 lg:col-start-3">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * The bar of a section (settings, statistics, the course catalog), which replaces the app's
 * navigation while the learner is in it: the way back on the left, one action of the section's on
 * the right. Nothing from the app bar: no goal, no tabs, no account. On the section's own first
 * page (its hub) the way back leaves the section for the app page the learner left for it; on the
 * pages under it (`parent`) it goes back to the hub, whose name it shows beside it. `wide` lines it
 * up with a page as wide as the screen (the catalog's grid). `home` starts the bar with the way
 * home instead, for a section beside the app (the catalog).
 */
export function LearnSectionBar({
  backHref,
  end,
  home = false,
  parent,
  title,
  wide = false,
}: {
  /** Where the way back (or home) leads when there's no app page to return to. */
  backHref: string;
  end?: React.ReactNode;
  home?: boolean;
  /** The section's hub, for a page under it: the way back leads there and the bar names it. */
  parent?: { href: string; label: string };
  /**
   * On the hub itself, its name beside the way back from `lg`, where its first page sits beside the
   * sidebar instead of its large title.
   */
  title?: string;
  wide?: boolean;
}) {
  const scrolled = useScrolled();

  return (
    <header
      className={cn(
        BAR_SURFACE_CLASS,
        "sticky top-0 z-30",
        scrolled ? "border-border" : "border-transparent",
      )}
      data-slot="learn-section-bar"
    >
      <div
        className={cn(
          "mx-auto flex w-full items-center justify-between gap-3 px-4 pt-3 pb-2 lg:py-3",
          wide ? "sm:px-6 lg:px-8" : "max-w-150 lg:max-w-5xl lg:px-6",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <SectionBarStart backHref={backHref} home={home} parent={parent} title={title} />
        </div>

        <div className="flex items-center justify-end gap-2">{end}</div>
      </div>
    </header>
  );
}

function SectionBarStart({
  backHref,
  home,
  parent,
  title,
}: {
  backHref: string;
  home: boolean;
  parent?: { href: string; label: string };
  title?: string;
}) {
  if (home) {
    return <LearnHomeLink href={backHref} />;
  }

  if (!parent) {
    return (
      <>
        <LearnBackLink href={backHref} toApp />
        {title && (
          <span
            aria-hidden="true"
            className="hidden min-w-0 truncate text-lg font-semibold tracking-tight lg:inline"
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
      <span aria-hidden="true" className="min-w-0 truncate text-lg font-semibold tracking-tight">
        {parent.label}
      </span>
    </>
  );
}

export { markAppEntry } from "./app-history";
