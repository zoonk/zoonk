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

  return undefined;
}

/**
 * From `lg` the sidebar is the way between the pages it lists, so a page it lists has no way back
 * there. A learner's sidebar lists their own pages, a visitor's the catalog. Which sidebar this is
 * comes from `data-signed-in`, which a script sets before the first paint, never from the
 * sidebar's current mark, which streams in after it: the bar draws no way back it then hides.
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
  const name = backLinkName({ appBack: appName, own: label || tabName, toApp });

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
      aria-label={name ? t("Back to {page}", { page: name }) : t("Back")}
      render={<LearnLink className={className} href={href} onClick={onClick} ref={ref} />}
    >
      {name ?? t("Back")}
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

/**
 * The bar over a section's pages (settings, statistics, the catalog). A page under `parent` goes
 * back to it; the others leave the section for the app page the learner came from, or `back`.
 */
export function LearnSectionBar({
  back,
  end,
  listed,
  parent,
  title,
}: {
  back: { href: string; label?: string };
  end?: React.ReactNode;
  listed?: ListedBy;
  /** `tabs`: the section's hub, which from a tablet up is these pages' own tabbed page. */
  parent?: { href: string; label: string; tabs?: boolean };
  title?: string;
}) {
  const fromApp = useCameFromApp();
  const className = listed && LISTED_IN_SIDEBAR_CLASS[listed];

  useNameAppEntry(title);

  const leave = (hidden?: string) => (
    <LearnBackLink className={cn(className, hidden)} href={back.href} label={back.label} toApp />
  );

  if (!parent || fromApp) {
    return <PageTopBar actions={end} back={leave()} />;
  }

  const toParent = (hidden?: string) => (
    <LearnBackLink className={cn(className, hidden)} href={parent.href} label={parent.label} />
  );

  return (
    <PageTopBar
      actions={end}
      back={
        parent.tabs ? (
          <>
            {toParent("md:hidden")}
            {leave("max-md:hidden")}
          </>
        ) : (
          toParent()
        )
      }
    />
  );
}

export { markAppEntry, nameAppEntry } from "./app-history";
