"use client";

import { usePathname } from "@/i18n/navigation";
import { LearnSectionBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";

export type SectionLink = { href: string; title: string };

export function SectionBarFrame({
  end,
  hub,
  parents,
  tabbedHub = false,
}: {
  end?: React.ReactNode;
  hub: SectionLink;
  parents?: SectionLink[];
  tabbedHub?: boolean;
}) {
  const t = useExtracted();
  const pathname = usePathname();
  const isHub = pathname === hub.href;
  const parent = parents?.find((place) => pathname.startsWith(`${place.href}/`));
  const today = { href: "/today", label: t("Today") };
  const list = parent ?? hub;

  return (
    <LearnSectionBar
      back={isHub ? today : { href: list.href, label: list.title }}
      end={end}
      history={isHub ? "destination" : "section-entry"}
      tabletBack={tabbedHub && !isHub && !parent ? today : undefined}
      title={isHub ? hub.title : undefined}
    />
  );
}
