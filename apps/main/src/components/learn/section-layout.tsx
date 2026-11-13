"use client";

import { usePathname } from "@/i18n/navigation";
import { LearnBackLink, LearnSectionBar } from "@zoonk/learn/bar";

export type SectionLink = { href: string; title: string };

type SectionPlaces = { hub: SectionLink; parents?: SectionLink[] };

/** A page under one of `parents` goes back to it; any other page but the hub goes back to the hub. */
function useSectionParent({ hub, parents }: SectionPlaces): SectionLink | undefined {
  const pathname = usePathname();

  if (pathname === hub.href) {
    return undefined;
  }

  return parents?.find((parent) => pathname.startsWith(`${parent.href}/`)) ?? hub;
}

export function SectionBarFrame({
  backHref,
  className,
  end,
  ...places
}: SectionPlaces & { backHref: string; className?: string; end?: React.ReactNode }) {
  const parent = useSectionParent(places);

  return (
    <LearnSectionBar
      backHref={backHref}
      className={className}
      end={end}
      parent={parent && { href: parent.href, label: parent.title }}
      title={parent ? undefined : places.hub.title}
    />
  );
}

/** From a tablet up the bar is gone and the tabs mark the hub's pages, so only a page under a tab links back to it. */
export function SectionParentLink(places: SectionPlaces) {
  const parent = useSectionParent(places);

  if (!parent || parent === places.hub) {
    return null;
  }

  return (
    <LearnBackLink
      className="hidden self-start md:inline-flex"
      crumb
      href={parent.href}
      label={parent.title}
    />
  );
}
