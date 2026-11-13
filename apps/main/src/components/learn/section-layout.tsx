"use client";

import { usePathname } from "@/i18n/navigation";
import { LearnSectionBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";

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

/** A `root` section's pages are in the sidebar, so from `lg` only a page under a parent links back. */
export function SectionBarFrame({
  end,
  root,
  ...places
}: SectionPlaces & { end?: React.ReactNode; root?: boolean }) {
  const t = useExtracted();
  const parent = useSectionParent(places);
  const isRoot = root && (!parent || parent === places.hub);

  return (
    <LearnSectionBar
      back={{ href: "/today", label: t("Today") }}
      end={end}
      parent={parent && { href: parent.href, label: parent.title }}
      root={isRoot}
      title={parent ? undefined : places.hub.title}
    />
  );
}
