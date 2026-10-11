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
import { KindTile } from "../_components/kind-tile";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { Surface } from "../_components/surface";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { LearnPageBar } from "../shell/learn-bar";
import { type MindMapActions } from "./mind-map-actions";
import { MapTile } from "./mind-map-tiles";

export type { MindMapLimit } from "../_components/help-limit-notice";
export type { MindMapActions, MindMapRequestOutcome } from "./mind-map-actions";

/** Where the page leads: back to the Journey, a chapter's page, and Today to keep studying. */
export type MindMapsHrefs = { back: string; chapter: (chapterId: string) => string; today: string };

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

      <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
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

function EmptyMaps({ hrefs }: { hrefs: MindMapsHrefs }) {
  const t = useExtracted();

  return (
    <Surface className="flex flex-col items-start gap-3 p-5" data-slot="mind-maps-empty">
      <KindTile kind="mindMap" />
      <div className="flex flex-col gap-1">
        <p className="text-[0.9375rem] font-medium">{t("No mind maps yet")}</p>
        <p className="text-muted-foreground text-sm text-pretty">
          {t("Finish a chapter to make its mind map: its main ideas in one picture.")}
        </p>
      </div>
      <LearnLink className={buttonVariants({ variant: "outline" })} href={hrefs.today}>
        {t("Keep studying")}
      </LearnLink>
    </Surface>
  );
}

/**
 * A goal's mind maps, for reviewing what the learner studied: every chapter they finished under its
 * subject, each map's thumbnail opening it full screen, and a tap to make the ones that don't exist
 * yet. While their maps are at their plan's cap (`cap`), the taps stay in sight and wait, and the
 * page says so once, with the one thing to do. Before any chapter is finished, it says how maps
 * come.
 */
export function MindMapsScreen({
  actions,
  cap = null,
  hrefs,
  mindMaps,
}: {
  actions: MindMapActions;
  cap?: MindMapLimit | null;
  hrefs: MindMapsHrefs;
  mindMaps: GoalMindMapsView;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const groups = groupBySubject(mindMaps.chapters);
  const drawn = mindMaps.chapters.filter((chapter) => chapter.status === "ready").length;
  const capped = cap !== null && drawn < mindMaps.chapters.length;

  return (
    <article className="flex flex-col gap-8" data-slot="mind-maps">
      <LearnPageBar back={{ href: hrefs.back, label: t("Journey") }} title={t("Mind maps")} />

      <DetailLayout>
        <DetailAside>
          <DetailHero>
            <KindTile kind="mindMap" size="lg" />
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
          {groups.length === 0 && <EmptyMaps hrefs={hrefs} />}
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
    </article>
  );
}
