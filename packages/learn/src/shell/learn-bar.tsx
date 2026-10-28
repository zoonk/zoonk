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

const BAR_HEIGHT_PX = 64;

const BAR_SURFACE_CLASS =
  "bg-background/95 supports-backdrop-filter:bg-background/80 border-b backdrop-blur transition-colors motion-reduce:transition-none";

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

export const CRUMB_LINK_CLASS =
  "text-foreground hover:bg-muted lg:text-muted-foreground lg:hover:text-foreground focus-visible:ring-ring/50 hit-area relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-[3px] [&_svg]:size-5 lg:-ml-1.5 lg:h-8 lg:w-auto lg:gap-0.5 lg:pr-1 lg:text-[0.8125rem] lg:hover:bg-transparent lg:[&_svg]:size-4";

function BackLinkName({ label }: { label?: string }) {
  const t = useExtracted();
  return label ? t("Back to {page}", { page: label }) : t("Back");
}

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
  href: string;
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
          {back.label && <span className="text-faint before:content-['/']" />}
          <span className="truncate font-medium">{title}</span>
        </span>
      )}

      {title && titleAway && (
        <span
          aria-hidden="true"
          className="motion-safe:animate-in motion-safe:fade-in duration-base line-clamp-2 min-w-0 text-sm leading-tight font-semibold text-pretty lg:hidden"
        >
          {title}
        </span>
      )}
    </div>
  );
}

export function LearnPageBar({
  back,
  children,
  root = false,
  title,
}: {
  back: { href: string; label?: string };
  children?: React.ReactNode;
  root?: boolean;
  title?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleAway = useTitleScrolledAway(ref);

  return (
    <PageBarSurface className={cn(root && !children && "lg:hidden")} ref={ref}>
      {/* As tall as an action's button even without one, so every page's bar, and its skeleton,
          share one height. */}
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

export function LearnSectionBar({
  backHref,
  className,
  end,
  parent,
  title,
}: {
  backHref: string;
  className?: string;
  end?: React.ReactNode;
  parent?: { href: string; label: string };
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
