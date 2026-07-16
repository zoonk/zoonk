"use client";

import { usePathname } from "@/i18n/navigation";
import { type ReactNode } from "react";
import { getMobileChapterNavTarget } from "./mobile-chapter-nav-target";

/**
 * Chapter pages replace the mobile catalog menu with back and close controls.
 * The account menu stays available on larger screens, but hiding it on mobile
 * leaves the close control as the only right-side navbar action.
 */
export function NavbarUserSlot({ children }: { children: ReactNode }) {
  const mobileChapterNavTarget = getMobileChapterNavTarget(usePathname());

  if (!mobileChapterNavTarget) {
    return children;
  }

  return <div className="hidden sm:block">{children}</div>;
}
