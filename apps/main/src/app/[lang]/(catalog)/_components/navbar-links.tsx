"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { CommandPalette } from "./command-palette";

function getVariant(href: string, pathname: string): "outline" | "secondary" | "default" {
  if (href === pathname) {
    return "default";
  }

  if (pathname !== "/" && href !== "/" && pathname.startsWith(href)) {
    return "default";
  }

  if (href === "/start") {
    return "secondary";
  }

  return "outline";
}

const homeMenu = getMenu("home");
const coursesMenu = getMenu("courses");
const startMenu = getMenu("start");

export function NavbarLinksSkeleton() {
  return (
    <>
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="size-9 rounded-full sm:h-9 sm:w-24" />
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="ml-auto size-9 rounded-full sm:h-9 sm:w-20" />
    </>
  );
}

export function NavbarLinks({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const t = useExtracted();

  const homeVariant = getVariant(homeMenu.url, pathname);
  const coursesVariant = getVariant(coursesMenu.url, pathname);
  const startVariant = getVariant(startMenu.url, pathname);

  return (
    <>
      <Link
        aria-current={homeVariant === "default" ? "page" : undefined}
        className={buttonVariants({ size: "icon", variant: homeVariant })}
        href={homeMenu.url}
        prefetch
      >
        <homeMenu.icon aria-hidden="true" />
        <span className="sr-only">{t("Home page")}</span>
      </Link>

      <Link
        aria-current={coursesVariant === "default" ? "page" : undefined}
        className={buttonVariants({ size: "adaptive", variant: coursesVariant })}
        href={coursesMenu.url}
        prefetch
      >
        <coursesMenu.icon aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{t("Courses")}</span>
      </Link>

      <CommandPalette isLoggedIn={isLoggedIn} />

      <Link
        aria-current={startVariant === "default" ? "page" : undefined}
        className={cn(buttonVariants({ size: "adaptive", variant: startVariant }), "ml-auto")}
        href={startMenu.url}
        prefetch
      >
        <startMenu.icon aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{t("New course")}</span>
      </Link>
    </>
  );
}
