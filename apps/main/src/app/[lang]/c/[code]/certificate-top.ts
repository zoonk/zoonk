import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The band at a certificate page's top. The page top and the bottom bar reach its edges by its
 * gutter and bottom padding, named here, and the page top's bar takes the band's gray, so it
 * doesn't draw a white strip that stops at the column's edges.
 */
export const CERTIFICATE_TOP_CLASS = cn(
  PUBLIC_CONTAINER_CLASS,
  "pb-(--page-bottom) [--page-bottom:--spacing(14)] [--page-gutter:--spacing(4)] sm:[--page-bottom:--spacing(16)] sm:[--page-gutter:--spacing(6)] lg:[--page-gutter:--spacing(8)]",
  "**:data-[slot=page-top-bar]:bg-ground/95 supports-backdrop-filter:**:data-[slot=page-top-bar]:bg-ground/80",
);
