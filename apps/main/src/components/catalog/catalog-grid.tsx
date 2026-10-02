"use client";

import { type AppRoute, Link } from "@/i18n/navigation";
import { GridContent, GridGroupItem, GridItem } from "@zoonk/ui/components/grid";
import { type ReactNode } from "react";
import { CatalogGridBackToTop } from "./catalog-grid-back-to-top";

/** Catalog grids share one floating back-to-top action instead of each page adding its own. */
export function CatalogGridContent({ children }: { children: ReactNode }) {
  return (
    <GridContent>
      {children}
      <CatalogGridBackToTop />
    </GridContent>
  );
}

/**
 * Grid items keep Next.js navigation in one link wrapper, while tile contents
 * remain fully composable through children.
 */
export function CatalogGridItem<Href extends string>({
  children,
  className,
  href,
  prefetch,
}: {
  children: ReactNode;
  className?: string;
  href: AppRoute<Href>;
  prefetch?: boolean;
}) {
  return (
    <GridGroupItem>
      <GridItem className={className} render={<Link href={href} prefetch={prefetch} />}>
        {children}
      </GridItem>
    </GridGroupItem>
  );
}
