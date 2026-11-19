"use client";

import { BackLink, PageTopBar } from "@zoonk/ui/components/page-top";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import {
  appBackName,
  backLinkName,
  cameFromApp,
  goBackTo,
  goBackToApp,
  nameAppEntry,
  subscribeToHistory,
} from "./app-history";
import { BARE_ON_COMPUTER_CLASS } from "./learn-shell";

/** `PageTopBar`'s height: a title above this line is under the bar. */
const BAR_HEIGHT_PX = 65;

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

function useCameFromApp(): boolean {
  // Read after hydration: the server has no history, and its render goes to the hub.
  return useSyncExternalStore(subscribeToHistory, cameFromApp, () => false);
}

function useAppBackName(): string | null {
  return useSyncExternalStore(subscribeToHistory, appBackName, () => null);
}

/** Names this page's history entry, so a back link that returns here says where it goes. */
function useNameAppEntry(name?: string) {
  useEffect(() => {
    if (name) {
      nameAppEntry(name);
    }
  }, [name]);
}

export function AppEntryName({ name }: { name: string }) {
  useNameAppEntry(name);
  return null;
}

/** A tab's name when `href` is the tab's page. */
function useTabName(href: string): string | undefined {
  const t = useExtracted();
  const routes = useLearnRoutes();

  if (href === routes.today) {
    return t("Today");
  }

  if (href === routes.journey) {
    return t("Plan");
  }

  if (href === routes.buddy) {
    return t("Buddy");
  }

  return undefined;
}

/**
 * From `lg` the sidebar is the way between the pages it lists, so a page it lists has no way back
 * there. A page says so (`listed`) only in the state this learner's sidebar lists it, from the
 * sidebar's own source, and the bar reads whose sidebar this is from `data-signed-in`, which a
 * script sets before the first paint, never from the sidebar's current mark, which streams in
 * after it: the bar draws no way back it then hides.
 */
const LISTED_IN_SIDEBAR_CLASS = {
  learner: "lg:[[data-signed-in]_&]:hidden",
  visitor: "lg:[:root:not([data-signed-in])_&]:hidden",
} as const;

/** Whose sidebar lists the page: `learner` for their own pages, `visitor` for the catalog. */
type ListedBy = keyof typeof LISTED_IN_SIDEBAR_CLASS;

/**
 * `label` names the page at `href`; a tab's page needs none. With `toApp` the link returns to
 * whatever app page came before, and names that page once the browser's history says which it was.
 */
function LearnBackLink({
  className,
  href,
  label,
  skipSection = false,
  toApp = false,
}: {
  className?: string;
  href: string;
  label?: string;
  skipSection?: boolean;
  toApp?: boolean;
}) {
  const t = useExtracted();
  const ref = useEscapeClick<HTMLAnchorElement>();
  const appName = useAppBackName();
  const tabName = useTabName(href);
  const routes = useLearnRoutes();
  const ownName = label || tabName;
  const historyName = toApp && appName ? appName : null;
  const name = backLinkName({ appBack: historyName, own: ownName, toApp }) ?? t("Today");
  const destination = ownName ? href : routes.today;

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    if (!isPlainClick) {
      return;
    }

    const wentBack = historyName
      ? goBackToApp()
      : goBackTo(event.currentTarget.href, { skipSection });

    if (wentBack) {
      event.preventDefault();
    }
  };

  return (
    <BackLink
      aria-label={t("Back to {page}", { page: name })}
      render={<LearnLink className={className} href={destination} onClick={onClick} ref={ref} />}
    >
      {name}
    </BackLink>
  );
}

/**
 * A `root` page goes back to the app page the learner came from. In a `section`, back returns to
 * the page the learner came from outside it, as in `LearnSectionBar`.
 */
export function LearnPageBar({
  back,
  children,
  listed,
  root = false,
  section = false,
  title,
}: {
  back: { href: string; label?: string };
  children?: React.ReactNode;
  listed?: ListedBy;
  root?: boolean;
  section?: boolean;
  title?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleAway = useTitleScrolledAway(ref);
  const fromApp = useCameFromApp();
  const toApp = root || (fromApp && section);

  useNameAppEntry(title);

  return (
    <PageTopBar
      className={listed && !children ? BARE_ON_COMPUTER_CLASS[listed] : undefined}
      // `data-title-away` (`group-data-title-away/page-bar`) lets an action give way to the page's
      // name on a phone, as Ask (its face alone) and a visitor's links (hidden) do.
      actions={
        children && (
          <div
            className="group/page-bar contents"
            data-title-away={(title && titleAway) || undefined}
          >
            {children}
          </div>
        )
      }
      back={
        <>
          {/* With the page's name in the bar, the way back is its chevron; its words stay its name. */}
          <LearnBackLink
            className={cn(
              listed && LISTED_IN_SIDEBAR_CLASS[listed],
              title && titleAway && "[&]:shrink-0 [&>span]:sr-only",
            )}
            href={back.href}
            label={back.label}
            toApp={toApp}
          />

          {title && titleAway && (
            <span
              aria-hidden="true"
              className="motion-safe:animate-in motion-safe:fade-in duration-base line-clamp-2 min-w-0 text-sm leading-tight font-semibold text-pretty"
            >
              {title}
            </span>
          )}
        </>
      }
      ref={ref}
    />
  );
}

/** The bar over a section's pages, including links that return to the app page that opened it. */
export function LearnSectionBar({
  back,
  end,
  history = "origin",
  listed,
  phoneEnd,
  tabletBack,
  title,
}: {
  back: { href: string; label?: string };
  end?: React.ReactNode;
  /** The bar's end under `lg` only, where no sidebar holds it. */
  phoneEnd?: React.ReactNode;
  /** A section entry returns to the page outside the section that opened it. */
  history?: "destination" | "origin" | "section-entry";
  listed?: ListedBy;
  tabletBack?: { href: string; label?: string };
  title?: string;
}) {
  const fromApp = useCameFromApp();
  const toApp = history === "origin" || (history === "section-entry" && fromApp);

  const alternate = toApp ? undefined : tabletBack;
  const className = listed && LISTED_IN_SIDEBAR_CLASS[listed];

  useNameAppEntry(title);

  return (
    <PageTopBar
      actions={
        (end || phoneEnd) && (
          <>
            {end}
            {phoneEnd && <div className="contents lg:hidden">{phoneEnd}</div>}
          </>
        )
      }
      className={listed && !end ? BARE_ON_COMPUTER_CLASS[listed] : undefined}
      back={
        <>
          <LearnBackLink
            className={cn(className, alternate && "md:hidden")}
            href={back.href}
            label={back.label}
            toApp={toApp}
          />

          {alternate && (
            <LearnBackLink
              className={cn(className, "max-md:hidden")}
              href={alternate.href}
              label={alternate.label}
              skipSection
            />
          )}
        </>
      }
    />
  );
}

export { markAppEntry, nameAppEntry } from "./app-history";
