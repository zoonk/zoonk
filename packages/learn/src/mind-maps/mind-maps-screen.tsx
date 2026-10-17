"use client";

import { type GoalMindMapView, type GoalMindMapsView } from "@zoonk/core/mind-maps/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import {
  DetailAside,
  DetailContent,
  DetailEyebrow,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailLayout,
  DetailTitle,
} from "../_components/detail-page";
import { type MindMapLimit, MindMapLimitNotice } from "../_components/help-limit-notice";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { LearnPageBar } from "../shell/learn-bar";
import { type MindMapActions } from "./mind-map-actions";
import { MapTile } from "./mind-map-tiles";

export type { MindMapLimit } from "../_components/help-limit-notice";
export type { MindMapActions, MindMapRequestOutcome } from "./mind-map-actions";

/** Where the page leads: back to the Plan, a chapter's page, and Today to keep studying. */
export type MindMapsHrefs = { back: string; chapter: (chapterId: string) => string; today: string };

/** The plan's next chapter, whose map comes once the learner finishes it, with its lessons left. */
export type NextMindMap = { chapterId: string; lessonsLeft: number; title: string };

type MapGroup = { key: string; maps: GoalMindMapView[]; name: string | null };

/** The maps under their subjects, in the order the plan first reaches each subject. */
function groupBySubject(chapters: readonly GoalMindMapView[]): MapGroup[] {
  const groups = Map.groupBy(chapters, (chapter) => chapter.subject?.key ?? "");

  return [...groups.entries()].map(([key, maps]) => ({
    key,
    maps,
    name: maps[0]?.subject?.name ?? null,
  }));
}

function MapSection({
  actions,
  capped,
  group,
  hrefs,
}: {
  actions: MindMapActions;
  capped: boolean;
  group: MapGroup;
  hrefs: MindMapsHrefs;
}) {
  const t = useExtracted();
  const titleId = `mind-maps-${group.key || "chapters"}`;

  return (
    <PageSection aria-labelledby={titleId} className="scroll-mt-24" id={group.key || undefined}>
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{group.name ?? t("Chapters you finished")}</PageSectionTitle>
        <PageSectionDetail>
          {t("{count, plural, one {# chapter} other {# chapters}}", { count: group.maps.length })}
        </PageSectionDetail>
      </PageSectionHeader>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] sm:gap-x-4">
        {group.maps.map((mindMap) => (
          <MapTile
            actions={actions}
            capped={capped}
            hrefs={hrefs}
            key={mindMap.chapterId}
            mindMap={mindMap}
          />
        ))}
      </ul>
    </PageSection>
  );
}

/**
 * Before any chapter is finished: how maps come and the way to the first one, the plan's next
 * chapter with its lessons left ("Continue" opens it); without one in sight, back to studying.
 */
function EmptyMaps({ hrefs, next }: { hrefs: MindMapsHrefs; next: NextMindMap | null }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-start gap-3" data-slot="mind-maps-empty">
      <div className="flex flex-col gap-1">
        <p className="text-[0.9375rem] font-medium">{t("No mind maps yet")}</p>
        <p className="text-muted-foreground text-[0.8125rem] text-pretty">
          {t("Finish a chapter to make its mind map: its main ideas in one picture.")}
        </p>
        {next && (
          <p className="text-[0.8125rem] text-pretty">
            {t(
              "{count, plural, one {Your first one comes after {chapter}: # lesson left.} other {Your first one comes after {chapter}: # lessons left.}}",
              { chapter: next.title, count: next.lessonsLeft },
            )}
          </p>
        )}
      </div>
      <LearnLink
        className={buttonVariants({ size: "sm", variant: "outline" })}
        href={next ? hrefs.chapter(next.chapterId) : hrefs.today}
      >
        {next ? t("Continue") : t("Keep studying")}
      </LearnLink>
    </div>
  );
}

/**
 * A goal's mind maps, for reviewing what the learner studied: every chapter they finished under its
 * subject, a gallery as wide as the page allows, each map's thumbnail opening it full screen, and a
 * tap to make the ones that don't exist yet. While their maps are at their plan's cap (`cap`), the taps stay in sight and wait, and the
 * page says so once, with the one thing to do. Before any chapter is finished, it says how maps
 * come and which chapter's map comes first.
 */
export function MindMapsScreen({
  actions,
  cap = null,
  hrefs,
  mindMaps,
  next = null,
}: {
  actions: MindMapActions;
  cap?: MindMapLimit | null;
  hrefs: MindMapsHrefs;
  mindMaps: GoalMindMapsView;
  /** The plan's next chapter, named while no map exists yet; null when there's none to open. */
  next?: NextMindMap | null;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const groups = groupBySubject(mindMaps.chapters);
  const drawn = mindMaps.chapters.filter((chapter) => chapter.status === "ready").length;
  const capped = cap !== null && drawn < mindMaps.chapters.length;

  return (
    <DetailLayout
      bar={<LearnPageBar back={{ href: hrefs.back }} root title={t("Mind maps")} />}
      data-slot="mind-maps"
    >
      <DetailAside>
        <DetailHero>
          <DetailHeroText>
            <DetailEyebrow>{mindMaps.goal.title}</DetailEyebrow>
            <DetailTitle>{t("Mind maps")}</DetailTitle>
            {mindMaps.chapters.length > 0 && (
              <DetailFacts>
                {t("{count, plural, =0 {# maps} one {# map} other {# maps}}", { count: drawn })}
              </DetailFacts>
            )}
          </DetailHeroText>
        </DetailHero>
        {capped && cap && (
          <MindMapLimitNotice limit={cap} linkComponent={LearnLink} routes={routes} />
        )}
      </DetailAside>

      <DetailContent>
        {groups.length === 0 && <EmptyMaps hrefs={hrefs} next={next} />}
        {groups.map((group) => (
          <MapSection
            actions={actions}
            capped={capped}
            group={group}
            hrefs={hrefs}
            key={group.key}
          />
        ))}
      </DetailContent>
    </DetailLayout>
  );
}
