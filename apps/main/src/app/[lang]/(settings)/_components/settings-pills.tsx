"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";

/** Keeps the current settings page's pill visible on phones, where the row scrolls. */
export function SettingsPillLinks({
  showGuardian,
  showMemory,
}: {
  showGuardian: boolean;
  showMemory: boolean;
}) {
  const pathname = usePathname();
  const t = useExtracted();
  const currentLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    currentLinkRef.current?.scrollIntoView({
      behavior: getScrollBehavior(),
      block: "nearest",
      inline: "center",
    });
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- A route change assigns the current DOM ref; scrolling must run again for the new page.
  }, [pathname]);

  const items = [
    { label: t("Profile"), ...getMenu("profile") },
    { label: t("Appearance"), ...getMenu("appearance") },
    showMemory && { label: t("Memory"), ...getMenu("memory") },
    showGuardian && { label: t("Guardian"), ...getMenu("guardian") },
    { label: t("Subscription"), ...getMenu("subscription") },
    { label: t("Language"), ...getMenu("language") },
    { label: t("Feedback & Support"), ...getMenu("support") },
  ].filter((item) => item !== false);

  return items.map((item) => {
    const isCurrent = pathname === item.url;

    return (
      <Link
        aria-current={isCurrent ? "page" : undefined}
        className={buttonVariants({ size: "sm", variant: isCurrent ? "default" : "outline" })}
        href={item.url}
        key={item.url}
        prefetch
        ref={isCurrent ? currentLinkRef : undefined}
      >
        <item.icon aria-hidden className="size-4" />
        {item.label}
      </Link>
    );
  });
}
