"use client";

import { BackLink, PageTopBar } from "@zoonk/ui/components/page-top";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { goBackTo } from "./app-history";
import { NO_WAY_BACK, type NoWayBack } from "./learn-shell";

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

/** Whose sidebar lists the page, which the sidebar then leads to from `lg`. */
type ListedBy = "learner" | "visitor";

/** Each case as it holds from `lg` alone. */
const ON_COMPUTER: Record<NoWayBack, NoWayBack> = {
  computer: "computer",
  learner: "learner",
  sectionTabs: "computer",
  tabs: "learner",
  visitor: "visitor",
};

/** The link's and the bar's classes for where nothing would be left for the way back to do. */
function noWayBack(cases: (NoWayBack | false | undefined)[]) {
  const shown = cases.filter((key): key is NoWayBack => Boolean(key));

  return {
    back: cn(shown.map((key) => NO_WAY_BACK[key].back)),
    bare: cn(shown.map((key) => NO_WAY_BACK[key].bare)),
  };
}

/** A plain click returns through history when the page behind is the link's own, as it was left. */
function returnBack(event: React.MouseEvent<HTMLAnchorElement>) {
  const isPlainClick =
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

  if (isPlainClick && goBackTo(event.currentTarget.href)) {
    event.preventDefault();
  }
}

/** `label` names the page at `href`; a tab's page needs none. */
function LearnBackLink({
  className,
  href,
  label,
}: {
  className?: string;
  href: string;
  label?: string;
}) {
  const t = useExtracted();
  const ref = useEscapeClick<HTMLAnchorElement>();
  const tabName = useTabName(href);
  const routes = useLearnRoutes();
  const ownName = label || tabName;
  const name = ownName ?? t("Today");
  const destination = ownName ? href : routes.today;

  return (
    <BackLink
      aria-label={t("Back to {page}", { page: name })}
      render={<LearnLink className={className} href={destination} onClick={returnBack} ref={ref} />}
    >
      {name}
    </BackLink>
  );
}

/**
 * The way back names the page it leads to, never the page the learner happened to come from. A
 * `root` page is one the tab bar or the sidebar opens, whose way back is Today, the Plan or the
 * buddy: a learner already has those, so it draws no link for them (`NO_WAY_BACK.tabs`).
 */
export function LearnPageBar({
  back,
  children,
  listed,
  root = false,
  title,
}: {
  back: { href: string; label?: string };
  children?: React.ReactNode;
  listed?: ListedBy;
  root?: boolean;
  title?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleAway = useTitleScrolledAway(ref);
  const hidden = noWayBack([listed, root && "tabs"]);

  return (
    <PageTopBar
      className={hidden.bare}
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
            className={cn(hidden.back, title && titleAway && "[&]:shrink-0 [&>span]:sr-only")}
            href={back.href}
            label={back.label}
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
 * The bar over a section's pages (settings, statistics, the catalog). `root` is the section's
 * first page, whose way back is Today; `sectionTabs` is one of the pages its own tabs lead
 * between, which from `md` needs no way back to the first.
 */
export function LearnSectionBar({
  back,
  end,
  listed,
  phoneEnd,
  root = false,
  sectionTabs = false,
}: {
  back: { href: string; label?: string };
  end?: React.ReactNode;
  listed?: ListedBy;
  /** The bar's end under `lg` only, where no sidebar holds it. */
  phoneEnd?: React.ReactNode;
  root?: boolean;
  sectionTabs?: boolean;
}) {
  const cases = [listed, root && "tabs", sectionTabs && "sectionTabs"] as const;
  const hidden = noWayBack([...cases]);
  // A phone's end keeps the bar's row under `lg`, so it gives the row up only where that end hides.
  const bare = phoneEnd ? noWayBack(cases.map((key) => key && ON_COMPUTER[key])).bare : hidden.bare;

  return (
    <PageTopBar
      actions={
        (end || phoneEnd) && (
          <>
            {end}
            {phoneEnd && (
              <div className="contents lg:hidden" data-phone-only="">
                {phoneEnd}
              </div>
            )}
          </>
        )
      }
      back={<LearnBackLink className={hidden.back} href={back.href} label={back.label} />}
      className={bare}
    />
  );
}

export { markAppEntry } from "./app-history";
