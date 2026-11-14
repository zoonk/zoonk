import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { FloatingStartLink, ShownWhenStartAway, StickyStartBar } from "./page-start";
import { VisitorOnly } from "./visitor-only";

/** In the app's frame a visitor has no tab bar, so a phone pins the page's one action there. */
export async function VisitorStartBar() {
  const t = await getExtracted();

  return (
    <VisitorOnly>
      <StickyStartBar
        className="sm:[--page-gutter:--spacing(8)] lg:hidden"
        rowClassName="sm:mx-auto sm:max-w-3xl"
      >
        <FloatingStartLink className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          {t("Build my plan")}
        </FloatingStartLink>
      </StickyStartBar>
    </VisitorOnly>
  );
}

/** The sidebar's copy of it, over "Log in". A collapsed sidebar has no room for its words. */
export async function VisitorStartButton() {
  const t = await getExtracted();

  return (
    <ShownWhenStartAway className="sidebar-collapsed:hidden">
      <FloatingStartLink className={cn(buttonVariants(), "w-full")}>
        {t("Build my plan")}
      </FloatingStartLink>
    </ShownWhenStartAway>
  );
}
