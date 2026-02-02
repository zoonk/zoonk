"use client";

import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useSelectedLayoutSegment } from "next/navigation";

export function SettingsPills() {
  const segment = useSelectedLayoutSegment();
  const t = useExtracted();

  const items = [
    { label: t("Subscription"), segment: "subscription", ...getMenu("subscription") },
    { label: t("Language"), segment: "language", ...getMenu("language") },
    { label: t("Display name"), segment: "name", ...getMenu("displayName") },
    { label: t("Support"), segment: "support", ...getMenu("support") },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
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
      ))}
    </div>
  );
}
