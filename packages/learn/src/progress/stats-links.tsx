"use client";

import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { LearnLink } from "../learn-link";
import { useProgressScreen } from "./progress-context";

/** The stats pages behind the numbers, one tap away. */
export function StatsLinks() {
  const t = useExtracted();
  const { hrefs } = useProgressScreen();

  const links = [
    { href: hrefs.level, label: t("Brain Power and belt") },
    { href: hrefs.energy, label: t("Energy") },
    { href: hrefs.activity, label: t("Activity") },
    { href: hrefs.patterns, label: t("Patterns") },
    { href: hrefs.score, label: t("Score") },
  ];

  return (
    <nav aria-labelledby="stats-links-title" className="flex flex-col gap-2">
      <SectionLabel id="stats-links-title">{t("Your stats")}</SectionLabel>
      <ul className="flex flex-col">
        {links.map((link) => (
          <li key={link.href}>
            <LearnLink
              className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-11 items-center justify-between rounded-xl px-2 text-sm outline-none focus-visible:ring-[3px]"
              href={link.href}
            >
              {link.label}
              <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4" />
            </LearnLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
