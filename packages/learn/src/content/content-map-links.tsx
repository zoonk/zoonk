"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { isUuid } from "@zoonk/utils/uuid";
import { ChevronRightIcon, MapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { useContentScreen } from "./content-context";

/** The map of the subject: every skill of the goal and how the skills connect. */
export function ContentMapEntry() {
  const t = useExtracted();
  const { hrefs } = useContentScreen();

  if (!hrefs.map) {
    return null;
  }

  return (
    <LearnLink
      className="bg-muted in-data-[mode=fun]:fun-glass focus-visible:ring-ring/50 flex items-start gap-3 rounded-2xl px-4 py-3.5 outline-none focus-visible:ring-[3px]"
      href={hrefs.map}
    >
      {/* Icons sit on the title's line, however the description wraps. */}
      <LineMarker aria-hidden="true" className="text-sm">
        <MapIcon className="text-muted-foreground in-data-[mode=fun]:text-fun-accent-violet size-5" />
      </LineMarker>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{t("Map of your subject")}</span>
        <span className="text-muted-foreground text-xs">
          {t("Every skill, how they connect and what's fading")}
        </span>
      </span>
      <LineMarker aria-hidden="true" className="text-sm">
        <ChevronRightIcon className="text-muted-foreground size-4" />
      </LineMarker>
    </LearnLink>
  );
}

/** A group that is a chapter of the plan opens its page; phases before their chapters don't. */
export function ChapterPageLink({ areaId }: { areaId: string }) {
  const t = useExtracted();
  const { hrefs } = useContentScreen();

  if (!hrefs.chapterBasePath || !isUuid(areaId)) {
    return null;
  }

  return (
    <LearnLink
      className="inline-flex min-h-11 items-center self-start text-sm font-medium underline underline-offset-4"
      href={`${hrefs.chapterBasePath}/${areaId}`}
    >
      {t("Open chapter")}
    </LearnLink>
  );
}
