"use client";

import { getMenu } from "@/lib/menu";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export function SettingsPillLinks() {
  const segment = useSelectedLayoutSegment();
  const t = useExtracted();

  const items = [
    { label: t("Profile"), segment: "profile", ...getMenu("profile") },
    { label: t("Subscription"), segment: "subscription", ...getMenu("subscription") },
    { label: t("Language"), segment: "language", ...getMenu("language") },
    { label: t("Support"), segment: "support", ...getMenu("support") },
  ];

  return items.map((item) => (
    <Link
      className={buttonVariants({
        size: "sm",
        variant: segment === item.segment ? "default" : "outline",
      })}
      href={item.url}
      key={item.segment}
    >
      <item.icon aria-hidden className="size-4" />
      {item.label}
    </Link>
  ));
}
