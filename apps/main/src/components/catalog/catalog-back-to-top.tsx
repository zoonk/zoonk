"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { getScrollBehavior } from "@zoonk/ui/lib/scroll-behavior";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowUpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type MouseEvent, useEffect, useState } from "react";
import { CATALOG_TOP_TARGET_ID } from "./catalog-top-target";

const BACK_TO_TOP_VISIBLE_SCROLL_Y = 360;

function isBackToTopVisible(): boolean {
  return globalThis.scrollY > BACK_TO_TOP_VISIBLE_SCROLL_Y;
}

function scrollToCatalogTop(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();

  globalThis.document
    .querySelector(`#${CATALOG_TOP_TARGET_ID}`)
    ?.scrollIntoView({ behavior: getScrollBehavior(), block: "start" });
}

export function CatalogBackToTop() {
  const t = useExtracted();
  const [isVisible, setIsVisible] = useState(false);
  const label = t("Back to top");

  useEffect(() => {
    function syncVisibility() {
      setIsVisible(isBackToTopVisible());
    }

    syncVisibility();
    globalThis.addEventListener("scroll", syncVisibility, { passive: true });

    return () => globalThis.removeEventListener("scroll", syncVisibility);
  }, []);

  return (
    <a
      aria-label={label}
      className={cn(
        buttonVariants({ size: "sm", variant: "ghost" }),
        "text-muted-foreground hover:text-foreground px-2 text-xs",
        "bg-background/85 border-border/40 fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-30 border shadow-[0_8px_24px_rgb(0_0_0/0.08)] backdrop-blur-md transition-[opacity,translate] md:right-6 lg:bottom-6",
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
      href={`#${CATALOG_TOP_TARGET_ID}`}
      onClick={scrollToCatalogTop}
      title={label}
    >
      <ArrowUpIcon aria-hidden="true" className="size-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
}
