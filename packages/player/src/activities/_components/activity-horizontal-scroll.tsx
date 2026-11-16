"use client";

import { HorizontalScroll } from "@zoonk/ui/components/horizontal-scroll";
import { useExtracted } from "next-intl";

/** The kit's sideways scroller, with its scroll sign, for anything in a card that can be wider than the card. */
export function ActivityHorizontalScroll(
  props: Omit<React.ComponentProps<typeof HorizontalScroll>, "labels">,
) {
  const t = useExtracted();

  return (
    <HorizontalScroll labels={{ left: t("Scroll left"), right: t("Scroll right") }} {...props} />
  );
}
