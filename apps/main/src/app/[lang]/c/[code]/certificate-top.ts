import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The band at a certificate page's top. The page top's bar reaches the column's edges by its
 * gutter, named here, and takes the band's gray, so it doesn't draw a white strip that stops at
 * the column's edges.
 */
export const CERTIFICATE_TOP_CLASS = cn(
  PUBLIC_CONTAINER_CLASS,
  "pb-14 [--page-gutter:--spacing(4)] sm:pb-16 sm:[--page-gutter:--spacing(6)] lg:[--page-gutter:--spacing(8)]",
  "**:data-[slot=page-top-bar]:bg-ground/95 supports-backdrop-filter:**:data-[slot=page-top-bar]:bg-ground/80",
);
