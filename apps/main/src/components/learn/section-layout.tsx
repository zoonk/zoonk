"use client";

import { usePathname } from "@/i18n/navigation";
import { AppEntryName } from "@zoonk/learn/bar";
import { LearnLink } from "@zoonk/learn/link";
import { BackLink, PageTopBar } from "@zoonk/ui/components/page-top";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
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
  const ref = useEscapeClick<HTMLAnchorElement>();
  const parent = parents?.find((place) => pathname.startsWith(`${place.href}/`));
  const destination = parent ?? { href: "/today", title: t("Today") };

  return (
    <>
      {pathname === hub.href && <AppEntryName name={hub.title} />}
      <PageTopBar
        actions={end}
        back={
          <BackLink
            aria-label={t("Back to {page}", { page: destination.title })}
            render={
              <LearnLink
                className={parent ? "md:hidden" : undefined}
                href={destination.href}
                ref={ref}
              />
            }
          >
            {destination.title}
          </BackLink>
        }
      />
    </>
  );
}
