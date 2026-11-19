"use client";

import { usePathname } from "@/i18n/navigation";
import { LearnSectionBar } from "@zoonk/learn/bar";

export type SectionLink = { href: string; title: string };

/**
 * The section's first page goes back to Today and a page inside one of its pages to that page; any
 * other is one of the pages its tabs lead between, and goes back to the first under `md`.
 */
export function SectionBarFrame({
  end,
  hub,
  parents,
}: {
  end?: React.ReactNode;
  hub: SectionLink;
  parents?: SectionLink[];
}) {
  const pathname = usePathname();
  const parent = parents?.find((place) => pathname.startsWith(`${place.href}/`));

  if (pathname === hub.href) {
    return <LearnSectionBar back={{ href: "/today" }} end={end} root />;
  }

  if (parent) {
    return (
      <LearnSectionBar
        back={{ href: parent.href, label: parent.title }}
        end={end}
        listed="beside"
      />
    );
  }

  return <LearnSectionBar back={{ href: hub.href, label: hub.title }} end={end} sectionTabs />;
}
