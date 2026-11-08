"use client";

import {
  type ChapterMindMapView,
  type GoalMindMapView,
  type GoalMindMapsView,
} from "@zoonk/core/mind-maps/contract";
import { DetailFacts, DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { useExtracted } from "next-intl";
import { DetailAside, DetailContent, DetailLayout } from "../_components/detail-page";
import { FreeWeekOverNotice } from "../_components/free-week-over";
import { LIST_GROUP_CLASS } from "../_components/list-group";
import {
  PageEyebrow,
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { useServedState } from "../_utils/use-served-state";
import { LearnPageBar } from "../shell/learn-bar";
import { type MindMapActions } from "./mind-map-actions";
import { MindMapRow } from "./mind-map-row";

export type { MindMapLimit } from "../_components/help-limit-notice";
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

/** A chapter that can no longer have a map leaves the list. */
function withMap(chapters: readonly GoalMindMapView[], next: ChapterMindMapView) {
  return chapters.flatMap((chapter): GoalMindMapView[] => {
    const { status } = next;

    if (chapter.chapterId !== next.chapterId) {
      return [chapter];
    }

    return status === "unavailable" ? [] : [{ ...chapter, ...next, status }];
  });
}

function MapSection({
  actions,
  group,
  onViewChange,
  plus,
}: {
  actions: MindMapActions;
  group: MapGroup;
  onViewChange: (view: ChapterMindMapView) => void;
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
            <MindMapRow
              actions={actions}
              onViewChange={onViewChange}
              place="library"
              plus={plus}
              view={mindMap}
            />
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
  const [chapters, setChapters] = useServedState(mindMaps.chapters);
  const groups = groupBySubject(chapters);
  const ready = chapters.filter((chapter) => chapter.status === "ready").length;

  const locked = chapters.some((chapter) => chapter.status === "plusRequired");

  const writesLessons = chapters.some(
    (chapter) =>
      chapter.lessonsToWrite > 0 &&
      (chapter.status === "available" || chapter.status === "writingLessons"),
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

        <p className="text-muted-foreground max-w-prose text-sm text-pretty">
          {t(
            "A chapter's main ideas in one picture. Every chapter you finish gets one; you can make one for any other chapter in your plan.",
          )}
          {writesLessons && " "}
          {writesLessons &&
            (plus
              ? t({
                  description:
                    '"These" are the chapters listed below whose lessons aren\'t written yet.',
                  message:
                    "Making a map for one of these writes its lessons first, so it takes a few minutes.",
                })
              : t({
                  description:
                    '"These" are the chapters listed below whose lessons aren\'t written yet.',
                  message:
                    "Making a map for one of these writes its lessons first, which counts toward your free lessons.",
                }))}
        </p>

        {locked && <FreeWeekOverNotice className="max-w-prose" />}
      </DetailAside>

      <DetailContent>
        {groups.map((group) => (
          <MapSection
            actions={actions}
            group={group}
            key={group.key}
            onViewChange={(next) => setChapters((current) => withMap(current, next))}
            plus={plus}
          />
        ))}
      </DetailContent>
    </DetailLayout>
  );
}
