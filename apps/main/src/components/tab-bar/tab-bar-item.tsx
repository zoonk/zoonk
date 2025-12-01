"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

type TabBarItemProps = {
  href: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  label: string;
  /** If true, matches exact path. If false, matches path prefix. */
  exact?: boolean;
};

function isActive(href: string, pathname: string, exact: boolean): boolean {
  if (exact) {
    return href === pathname;
  }
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
}

export function TabBarItem({
  href,
  icon: Icon,
  label,
  exact = false,
}: TabBarItemProps) {
  const pathname = usePathname();
  const active = isActive(href, pathname, exact);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({
          size: "icon",
          variant: active ? "default" : "ghost",
        }),
        "rounded-full",
      )}
      href={href}
    >
      <Icon aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Link>
  );
}
