"use client";

import { usePathname } from "@/i18n/navigation";
import { LearnSectionBar } from "@zoonk/learn/bar";
import { cn } from "@zoonk/ui/lib/utils";

export type SectionLink = { href: string; title: string };

type SectionPlaces = { hub: SectionLink; parents?: SectionLink[] };

/** Where in the section the page is: its first page, a page inside one of its pages, or one of its tabs. */
function useSectionPlace({ hub, parents }: SectionPlaces) {
  const pathname = usePathname();
  const parent = parents?.find((place) => pathname.startsWith(`${place.href}/`));

  if (pathname === hub.href) {
    return { kind: "hub" } as const;
  }

  return parent ? ({ kind: "inside", parent } as const) : ({ kind: "tab" } as const);
}

/**
 * The section's first page goes back to Today and a page inside one of its pages to that page; any
 * other is one of the pages its tabs lead between, and goes back to the first under `md`.
 */
export function SectionBarFrame({ end, ...places }: SectionPlaces & { end?: React.ReactNode }) {
  const place = useSectionPlace(places);
  const { hub } = places;

  if (place.kind === "hub") {
    return <LearnSectionBar back={{ href: "/today" }} end={end} root />;
  }

  if (place.kind === "inside") {
    return (
      <LearnSectionBar
        back={{ href: place.parent.href, label: place.parent.title }}
        end={end}
        listed="beside"
      />
    );
  }

  return <LearnSectionBar back={{ href: hub.href, label: hub.title }} end={end} sectionTabs />;
}

/** Where the section's bar draws no way back, per place: the same widths the bar gives its row up at. */
const TITLE_END_CLASS = {
  hub: "md:[[data-signed-in]_&]:flex",
  inside: "xl:in-data-signed-in:flex",
  tab: "md:flex",
} as const;

/**
 * The section's action at its title's end, where the bar has no row of its own for it. It takes no
 * height, so the title's row is the same with it, without it and while it loads.
 */
export function SectionTitleEnd({
  children,
  ...places
}: SectionPlaces & { children: React.ReactNode }) {
  const place = useSectionPlace(places);

  return (
    <div
      className={cn("hidden h-0 shrink-0 items-center gap-2", TITLE_END_CLASS[place.kind])}
      data-slot="section-title-end"
    >
      {children}
    </div>
  );
}
