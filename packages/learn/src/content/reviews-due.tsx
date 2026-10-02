"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { HourglassIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { useExperienceMode } from "../mode-provider";
import { useContentScreen } from "./content-context";

/**
 * Today's reviews open the Content tab: Focus calls them reviews, Fun calls them capsules. Both
 * lead to today's session, where they come first.
 */
export function ReviewsDue() {
  const t = useExtracted();
  const { content, hrefs } = useContentScreen();
  const isFun = useExperienceMode() === "fun";
  const due = content.capsules.dueToday;

  if (due === 0) {
    return null;
  }

  return (
    <div
      className="bg-muted in-data-[mode=fun]:fun-glass in-data-[mode=fun]:fun-holo-border flex items-center gap-3 rounded-2xl p-3 pl-4"
      data-slot="reviews-due"
    >
      {/* The icon stays on the text's first line when a long translation wraps. */}
      <p className="flex min-w-0 flex-1 items-start gap-3 text-sm font-medium">
        <LineMarker aria-hidden="true">
          <HourglassIcon className="text-muted-foreground in-data-[mode=fun]:text-fun-accent-cyan size-5" />
        </LineMarker>
        {isFun
          ? t("{count, plural, one {# capsule opens today} other {# capsules open today}}", {
              count: due,
            })
          : t("{count, plural, one {# skill to review today} other {# skills to review today}}", {
              count: due,
            })}
      </p>
      <LearnLink
        className={cn(
          buttonVariants({ size: "sm" }),
          "in-data-[mode=fun]:bg-fun-lime in-data-[mode=fun]:text-fun-lime-foreground",
        )}
        href={hrefs.capsules}
      >
        {isFun ? t("Open") : t("Review")}
      </LearnLink>
    </div>
  );
}
