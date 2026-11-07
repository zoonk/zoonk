"use client";

import { type GoalMindMapView, type GoalMindMapsView } from "@zoonk/core/mind-maps/contract";
import { DetailFacts, DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { useExtracted } from "next-intl";
import { DetailAside, DetailContent, DetailLayout } from "../_components/detail-page";
import { LIST_GROUP_CLASS } from "../_components/list-group";
import {
  PageEyebrow,
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { LearnPageBar } from "../shell/learn-bar";
import { type MindMapActions } from "./mind-map-actions";
import { MindMapRow } from "./mind-map-row";

export type { MindMapActions, MindMapRequestOutcome } from "./mind-map-actions";

type MapGroup = { key: string; maps: GoalMindMapView[]; name: string | null };

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
  group,
  plus,
}: {
  actions: MindMapActions;
  group: MapGroup;
  plus: boolean;
}) {
  const t = useExtracted();
  const titleId = `mind-maps-${group.key || "chapters"}`;

  return (
    <PageSection aria-labelledby={titleId} className="scroll-mt-24" id={group.key || undefined}>
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{group.name ?? t("Chapters")}</PageSectionTitle>
        <PageSectionDetail>
          {t("{count, plural, one {# chapter} other {# chapters}}", { count: group.maps.length })}
        </PageSectionDetail>
      </PageSectionHeader>

      <ul aria-labelledby={titleId} className={LIST_GROUP_CLASS}>
        {group.maps.map((mindMap) => (
          <li key={mindMap.chapterId}>
            <MindMapRow actions={actions} place="library" plus={plus} view={mindMap} />
          </li>
        ))}
      </ul>
    </PageSection>
  );
}

export function MindMapsScreen({
  actions,
  backHref,
  mindMaps,
  plus,
}: {
  actions: MindMapActions;
  backHref: string;
  mindMaps: GoalMindMapsView;
  plus: boolean;
}) {
  const t = useExtracted();
  const groups = groupBySubject(mindMaps.chapters);
  const ready = mindMaps.chapters.filter((chapter) => chapter.status === "ready").length;

  const writesFreeLessons =
    !plus &&
    mindMaps.chapters.some(
      (chapter) => chapter.status === "available" && chapter.lessonsToWrite > 0,
    );

  return (
    <DetailLayout
      bar={<LearnPageBar back={{ href: backHref }} root title={t("Mind maps")} />}
      data-slot="mind-maps"
    >
      <DetailAside>
        <DetailHero>
          <DetailHeroText>
            <PageEyebrow>{mindMaps.goal.title}</PageEyebrow>
            <DetailTitle>{t("Mind maps")}</DetailTitle>
            <DetailFacts>
              {t("{count, plural, =0 {# maps} one {# map} other {# maps}}", { count: ready })}
            </DetailFacts>
          </DetailHeroText>
        </DetailHero>

        <div className="text-muted-foreground flex max-w-prose flex-col gap-2 text-sm text-pretty">
          <p>
            {t(
              "A chapter's main ideas in one picture. Every chapter you finish gets one; you can make one for any other chapter in your plan.",
            )}
          </p>
          {writesFreeLessons && (
            <p>
              {t(
                "When a chapter's lessons aren't written yet, they get written first and count toward your free lessons.",
              )}
            </p>
          )}
        </div>
      </DetailAside>

      <DetailContent>
        {groups.map((group) => (
          <MapSection actions={actions} group={group} key={group.key} plus={plus} />
        ))}
      </DetailContent>
    </DetailLayout>
  );
}
