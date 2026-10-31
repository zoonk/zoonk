"use client";

import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DESIGN_PAGES } from "./pages";

export function DesignNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Design system"
      className="flex flex-col gap-0.5 lg:sticky lg:top-6 lg:self-start"
    >
      {DESIGN_PAGES.map((page) => (
        <Link
          aria-current={pathname === page.href ? "page" : undefined}
          className={cn(
            "text-muted-foreground hover:text-foreground hit-area relative rounded-md px-2.5 py-1.5 text-sm transition-colors",
            pathname === page.href && "bg-muted text-foreground font-medium",
          )}
          href={page.href}
          key={page.href}
          prefetch
        >
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
