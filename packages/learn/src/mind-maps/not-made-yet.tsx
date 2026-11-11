"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { ChevronDownIcon, PlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { MindMapLimitNotice } from "../_components/help-limit-notice";
import { LIST_GROUP_CLASS } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { StatusRegion } from "../_components/status-region";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import {
  type MindMapsPageChapter,
  countChapterMaps,
  toMindMapLimit,
} from "./_utils/mind-maps-page";
import { MindMapRowView } from "./mind-map-row";
import { type MindMapsLibrary } from "./use-mind-maps-library";

const LINE_CLASS = "text-muted-foreground max-w-prose text-sm text-pretty";

function ProgressLine({ library }: { library: MindMapsLibrary }) {
  const t = useExtracted();
  const { onTheWay, ready, total } = countChapterMaps(library.page.chapters);

  if (library.follower.isStuck) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className={LINE_CLASS}>{t("We couldn't reach the server. Check your connection.")}</p>
        <Button onClick={library.follower.retry} size="sm" variant="outline">
          {t("Try again")}
        </Button>
      </div>
    );
  }

  const made = t(
    "{total, plural, one {{ready, number} of # chapter map ready} other {{ready, number} of # chapter maps ready}}",
    { ready, total },
  );

  return (
    <p className={LINE_CLASS}>
      {onTheWay === 0 ? made : `${made} · ${t("{count, number} on the way", { count: onTheWay })}`}
    </p>
  );
}

function CreateAll({ library, tier }: { library: MindMapsLibrary; tier: EntitlementTier }) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const mountedAt = useMountTime();
  const { bulk, page } = library;
  const { eligible, needLessons, startable, stop } = page.createOffer;
  const shownStop = bulk.stop ?? (startable === 0 ? stop : null);
  const isAll = startable === eligible;

  return (
    <div className="flex flex-col items-start gap-3" data-slot="create-all-maps">
      {startable > 0 && (
        <p className={LINE_CLASS}>
          {isAll
            ? t(
                "{count, plural, one {# map remains. You can leave while it's made.} other {# maps remain. You can leave while they're made.}}",
                { count: eligible },
              )
            : t("Starts in course order, within your current allowance.")}
        </p>
      )}

      {startable > 0 && (
        <Button
          busy={bulk.status === "sending"}
          icon={<PlusIcon aria-hidden="true" />}
          onClick={bulk.createAll}
          size="lg"
          variant="outline"
        >
          {isAll
            ? t("Create all chapter maps")
            : t(
                "{count, plural, one {Create up to # chapter map} other {Create up to # chapter maps}}",
                { count: startable },
              )}
        </Button>
      )}

      <StatusRegion className="flex flex-col gap-3">
        {bulk.status === "unreachable" && (
          <p className={LINE_CLASS}>{t("We couldn't reach the server. Check your connection.")}</p>
        )}

        {eligible > 0 && shownStop && bulk.status !== "sending" && (
          <MindMapLimitNotice
            limit={toMindMapLimit({ now: mountedAt.getTime(), stop: shownStop, tier })}
            linkComponent={LearnLink}
            routes={routes}
          />
        )}
      </StatusRegion>

      {needLessons > 0 && (
        <p className={LINE_CLASS}>
          {t(
            "{count, plural, one {# chapter needs its lessons written first. Create its map on its own below.} other {# chapters need their lessons written first. Create each map on its own below.}}",
            { count: needLessons },
          )}{" "}
          {tier === "plus"
            ? t("Writing lessons takes a few minutes.")
            : t("Writing lessons counts toward your free lessons.")}
        </p>
      )}
    </div>
  );
}

function ChapterRows({
  chapters,
  library,
  plus,
}: {
  chapters: readonly MindMapsPageChapter[];
  library: MindMapsLibrary;
  plus: boolean;
}) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger
        render={<Button className="group/chapters self-start" size="sm" variant="outline" />}
      >
        {open ? t("Hide chapters") : t("Show chapters")}
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {chapters.length}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className="transition-transform group-data-panel-open/chapters:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <ul className={`${LIST_GROUP_CLASS} pt-3`}>
          {chapters.map((chapter) => (
            <li key={chapter.chapterId}>
              <MindMapRowView
                place="library"
                plus={plus}
                request={library.row(chapter)}
                view={{ ...chapter, image: null, outline: null }}
              />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The chapters without a map, after the ones that have one: how far along they are, one button to
 * make every map that needs no lessons written, and each chapter's own row on demand.
 */
export function NotMadeYet({
  chapters,
  library,
  tier,
}: {
  chapters: readonly MindMapsPageChapter[];
  library: MindMapsLibrary;
  tier: EntitlementTier;
}) {
  const t = useExtracted();
  const titleId = useId();

  return (
    <PageSection aria-labelledby={titleId} data-slot="maps-not-made">
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{t("Not made yet")}</PageSectionTitle>
      </PageSectionHeader>

      <StatusRegion>
        <ProgressLine library={library} />
      </StatusRegion>

      <CreateAll library={library} tier={tier} />
      <ChapterRows chapters={chapters} library={library} plus={tier === "plus"} />
    </PageSection>
  );
}
