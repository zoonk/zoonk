"use client";

import { BackLink, PageTopBar } from "@zoonk/ui/components/page-top";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import {
  appBackName,
  cameFromApp,
  goBackTo,
  goBackToApp,
  nameAppEntry,
  subscribeToHistory,
} from "./app-history";

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

  return undefined;
}

/**
 * From `lg` the sidebar is the way between the pages it lists, so a `root` page's way back gives
 * way only while the sidebar marks a page as the current one. Which pages it lists depends on the
 * learner (Exam only with an exam goal, Completed lessons once one is done), so a page it doesn't
 * list keeps its way back.
 */
const LISTED_IN_SIDEBAR_CLASS = "lg:[body:has([data-slot=sidebar]_[aria-current=page])_&]:hidden";

/**
 * `label` names the page at `href`; a tab's page needs none. With `toApp` the link returns to
 * whatever app page came before, and names that page once the browser's history says which it was.
 */
function LearnBackLink({
  className,
  href,
  label,
  toApp = false,
}: {
  className?: string;
  href: string;
  label?: string;
  toApp?: boolean;
}) {
  const t = useExtracted();
  const ref = useEscapeClick<HTMLAnchorElement>();
  const appName = useAppBackName();
  const tabName = useTabName(href);
  const name = (toApp && appName) || label || tabName || t("Back");

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
    <BackLink
      aria-label={t("Back to {page}", { page: name })}
      render={<LearnLink className={className} href={href} onClick={onClick} ref={ref} />}
    >
      {name}
    </BackLink>
  );
}

/**
 * A `root` page is one the sidebar may list (`LISTED_IN_SIDEBAR_CLASS`). In a `section`, back
 * returns to the page the learner came from outside it, as in `LearnSectionBar`.
 */
export function LearnPageBar({
  back,
  children,
  root = false,
  section = false,
  title,
}: {
  back: { href: string; label?: string };
  children?: React.ReactNode;
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
          <LearnBackLink
            className={root ? LISTED_IN_SIDEBAR_CLASS : undefined}
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

/**
 * The bar over a section's pages (settings, statistics, the catalog). A page under `parent` goes
 * back to it; the others leave the section for the app page the learner came from, or `back`.
 */
export function LearnSectionBar({
  back,
  end,
  parent,
  root = false,
  title,
}: {
  back: { href: string; label?: string };
  end?: React.ReactNode;
  parent?: { href: string; label: string };
  root?: boolean;
  title?: string;
}) {
  const fromApp = useCameFromApp();
  const className = root ? LISTED_IN_SIDEBAR_CLASS : undefined;

  useNameAppEntry(title);

  return (
    <PageTopBar
      actions={end}
      back={
        !parent || fromApp ? (
          <LearnBackLink className={className} href={back.href} label={back.label} toApp />
        ) : (
          <LearnBackLink className={className} href={parent.href} label={parent.label} />
        )
      }
    />
  );
}

export { markAppEntry, nameAppEntry } from "./app-history";
