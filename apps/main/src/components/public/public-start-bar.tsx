import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { FloatingStartLink, StickyStartBar } from "./page-start";

/** A public page's phone copy of its start; from `sm` the header holds it. */
export async function PublicStartBar() {
  const t = await getExtracted();

  return (
    <StickyStartBar className="sm:hidden">
      <FloatingStartLink className={cn(buttonVariants({ size: "lg" }), "w-full")}>
        {t("Build my plan")}
      </FloatingStartLink>
    </StickyStartBar>
  );
}
