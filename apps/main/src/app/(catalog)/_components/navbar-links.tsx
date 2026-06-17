"use client";

import { getMenu } from "@/lib/menu";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowLeftIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "./command-palette";
import {
  type MobileChapterNavTarget,
  getMobileChapterNavTarget,
} from "./mobile-chapter-nav-target";

function getVariant(href: string, pathname: string): "outline" | "secondary" | "default" {
  if (href === pathname) {
    return "default";
  }

  if (pathname !== "/" && href !== "/" && pathname.startsWith(href)) {
    return "default";
  }

  if (href === "/learn") {
    return "secondary";
  }

  return "outline";
}

const homeMenu = getMenu("home");
const learnMenu = getMenu("learn");
const MOBILE_CHAPTER_NAV_CLASS = "sm:hidden";
const DESKTOP_CHAPTER_NAV_CLASS = "hidden sm:inline-flex";

/**
 * Chapter pages need mobile chrome that points to the parent course instead of
 * the broader catalog sections. Keeping this as links preserves normal Next.js
 * prefetching and accessibility while removing the extra catalog actions on
 * small screens.
 */
function MobileChapterNavbarLinks({ courseHref }: MobileChapterNavTarget) {
  const t = useExtracted();

  return (
    <>
      <Link
        className={cn(
          buttonVariants({ size: "icon", variant: "outline" }),
          MOBILE_CHAPTER_NAV_CLASS,
        )}
        href={courseHref}
        prefetch
      >
        <ArrowLeftIcon aria-hidden="true" />
        <span className="sr-only">{t("Course page")}</span>
      </Link>

      <Link
        className={cn(
          buttonVariants({ size: "icon", variant: "outline" }),
          MOBILE_CHAPTER_NAV_CLASS,
        )}
        href="/"
        prefetch
      >
        <XIcon aria-hidden="true" />
        <span className="sr-only">{t("Home page")}</span>
      </Link>
    </>
  );
}

export function NavbarLinksSkeleton() {
  const mobileChapterNavTarget = getMobileChapterNavTarget(usePathname());

  if (mobileChapterNavTarget) {
    return null;
  }

  return (
    <>
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="ml-auto size-9 rounded-full sm:h-9 sm:w-20" />
    </>
  );
}

export function NavbarLinks({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const t = useExtracted();
  const mobileChapterNavTarget = getMobileChapterNavTarget(pathname);
  const desktopClassName = mobileChapterNavTarget ? DESKTOP_CHAPTER_NAV_CLASS : undefined;

  const homeVariant = getVariant(homeMenu.url, pathname);
  const learnVariant = getVariant(learnMenu.url, pathname);

  return (
    <>
      {mobileChapterNavTarget && (
        <MobileChapterNavbarLinks courseHref={mobileChapterNavTarget.courseHref} />
      )}

      <Link
        aria-current={homeVariant === "default" ? "page" : undefined}
        className={cn(buttonVariants({ size: "icon", variant: homeVariant }), desktopClassName)}
        href={homeMenu.url}
        prefetch
      >
        <homeMenu.icon aria-hidden="true" />
        <span className="sr-only">{t("Home page")}</span>
      </Link>

      <CommandPalette className={desktopClassName} isLoggedIn={isLoggedIn} />

      <Link
        aria-current={learnVariant === "default" ? "page" : undefined}
        className={cn(
          buttonVariants({ size: "adaptive", variant: learnVariant }),
          "ml-auto",
          desktopClassName,
        )}
        href={learnMenu.url}
        prefetch
      >
        <learnMenu.icon aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{t("Learn")}</span>
      </Link>
    </>
  );
}
