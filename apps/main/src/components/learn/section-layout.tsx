"use client";

import { usePathname } from "@/i18n/navigation";
import { LearnSectionBar } from "@zoonk/learn/bar";
import { useExtracted } from "next-intl";

export type SectionLink = { href: string; title: string };

export function SectionBarFrame({
  end,
  hub,
  parents,
}: {
  end?: React.ReactNode;
  hub: SectionLink;
  parents?: SectionLink[];
}) {
  const t = useExtracted();
  const pathname = usePathname();
  const isHub = pathname === hub.href;
  const parent = parents?.find((place) => pathname.startsWith(`${place.href}/`));
  const destination = isHub ? { href: "/today", title: t("Today") } : (parent ?? hub);

  return (
    <LearnSectionBar
      back={{ href: destination.href, label: destination.title }}
      end={end}
      history={isHub ? "destination" : "section-entry"}
      title={isHub ? hub.title : undefined}
    />
  );
}
