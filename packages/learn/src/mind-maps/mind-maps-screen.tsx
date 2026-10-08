"use client";

import { type GoalMindMapView, type GoalMindMapsView } from "@zoonk/core/mind-maps/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
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
import { MindMapLimitNotice } from "../_components/help-limit-notice";
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
import { toMindMapSrc } from "./_utils/mind-map-urls";
import { type MindMapActions } from "./mind-map-actions";
import { MindMapViewer } from "./mind-map-viewer";
import { useMindMapRequest } from "./use-mind-map-request";

export type { MindMapActions, MindMapRequestOutcome } from "./mind-map-actions";

/** Where the page leads: back to the Journey, a chapter's page, and Today to keep studying. */
export type MindMapsHrefs = { back: string; chapter: (chapterId: string) => string; today: string };

const TILE_CLASS = "aspect-square w-full rounded-xl";

/** The chapter's number and name under its tile. */
function TileCaption({ mindMap }: { mindMap: GoalMindMapView }) {
  const t = useExtracted();

  return (
    <span className="flex flex-col gap-0.5 text-left">
      <span className="text-muted-foreground text-[0.8125rem]">
        {t("Chapter {number, number}", { number: mindMap.position })}
      </span>
      <span className="line-clamp-2 text-[0.9375rem] leading-snug font-medium">
        {mindMap.title}
      </span>
    </span>
  );
}

/** A drawn map: its thumbnail opens it full screen. */
function MapPictureTile({ mindMap }: { mindMap: GoalMindMapView }) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);
  const { image } = mindMap;

  if (!image) {
    return null;
  }

  const alt = t("Mind map of {chapter}", { chapter: mindMap.title });

  return (
    <li>
      <button
        className="group focus-visible:ring-ring flex w-full flex-col gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        onClick={() => setOpen(true)}
        type="button"
      >
        {/* oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; thumbnails are stored, optimized webp files. */}
        <img
          alt={alt}
          className={cn(
            TILE_CLASS,
            "ring-foreground/10 bg-muted object-cover ring-1 transition-opacity group-hover:opacity-90",
          )}
          decoding="async"
          height={image.height}
          loading="lazy"
          src={toMindMapSrc(image.thumbnailUrl)}
          width={image.width}
        />
        <TileCaption mindMap={mindMap} />
      </button>

      <MindMapViewer
        image={image}
        onOpenChange={setOpen}
        open={open}
        outline={mindMap.outline}
        title={mindMap.title}
      />
    </li>
  );
}

/** A map without a picture (its text check failed twice): its chapter's page shows it in words. */
function MapInWordsTile({ href, mindMap }: { href: string; mindMap: GoalMindMapView }) {
  const t = useExtracted();

  return (
    <li>
      <LearnLink
        className="focus-visible:ring-ring flex flex-col gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        href={href}
      >
        <span
          className={cn(
            TILE_CLASS,
            "bg-muted/50 ring-foreground/10 flex flex-col items-center justify-center gap-2 ring-1",
          )}
        >
          <KindTile kind="mindMap" />
          <span className="text-muted-foreground text-[0.8125rem]">{t("As text")}</span>
        </span>
        <TileCaption mindMap={mindMap} />
      </LearnLink>
    </li>
  );
}

/** A chapter without its map yet: the tap that makes it, its wait, or why it didn't come. */
function MapRequestTile({
  actions,
  mindMap,
}: {
  actions: MindMapActions;
  mindMap: GoalMindMapView;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  const { create, isPending, limit, retry, shown } = useMindMapRequest({
    actions,
    chapterId: mindMap.chapterId,
    status: mindMap.status,
  });

  const isFailure = shown === "failed" || shown === "unreachable";
  const isGenerating = shown === "generating";
  // A cap reached keeps the button in sight, disabled, with the notice's one thing to do under
  // the tile; a short break keeps it working.
  const isCapped = limit?.status === "limitReached";

  return (
    <li className="flex flex-col gap-2">
      <span
        className={cn(
          TILE_CLASS,
          "flex flex-col items-center justify-center gap-3 border border-dashed p-3 text-center",
        )}
      >
        <KindTile kind="mindMap" />

        {isGenerating && (
          <span
            className="text-muted-foreground flex items-center gap-1.5 text-[0.8125rem]"
            role="status"
          >
            <Spinner aria-hidden="true" className="size-3.5" role="presentation" />
            {t("Drawing…")}
          </span>
        )}

        {!isGenerating && (
          <Button
            disabled={isPending || isCapped}
            onClick={isFailure ? retry : create}
            size="sm"
            variant="outline"
          >
            {isPending && (
              <Spinner aria-hidden="true" data-icon="inline-start" role="presentation" />
            )}
            {isFailure ? t("Try again") : t("Create")}
          </Button>
        )}
      </span>

      <TileCaption mindMap={mindMap} />
      {isFailure && (
        <p className="text-muted-foreground text-[0.8125rem]">
          {shown === "failed"
            ? t("It couldn't be made this time.")
            : t("We couldn't reach the server.")}
        </p>
      )}
      {limit && <MindMapLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />}
    </li>
  );
}

function MapTile({
  actions,
  hrefs,
  mindMap,
}: {
  actions: MindMapActions;
  hrefs: MindMapsHrefs;
  mindMap: GoalMindMapView;
}) {
  if (mindMap.status !== "ready") {
    return <MapRequestTile actions={actions} mindMap={mindMap} />;
  }

  return mindMap.image ? (
    <MapPictureTile mindMap={mindMap} />
  ) : (
    <MapInWordsTile href={hrefs.chapter(mindMap.chapterId)} mindMap={mindMap} />
  );
}

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
  group,
  hrefs,
}: {
  actions: MindMapActions;
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
          <MapTile actions={actions} hrefs={hrefs} key={mindMap.chapterId} mindMap={mindMap} />
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
 * yet. Before any chapter is finished, it says how maps come.
 */
export function MindMapsScreen({
  actions,
  hrefs,
  mindMaps,
}: {
  actions: MindMapActions;
  hrefs: MindMapsHrefs;
  mindMaps: GoalMindMapsView;
}) {
  const t = useExtracted();
  const groups = groupBySubject(mindMaps.chapters);
  const drawn = mindMaps.chapters.filter((chapter) => chapter.status === "ready").length;

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
        </DetailAside>

        <DetailContent>
          {groups.length === 0 && <EmptyMaps hrefs={hrefs} />}
          {groups.map((group) => (
            <MapSection actions={actions} group={group} hrefs={hrefs} key={group.key} />
          ))}
        </DetailContent>
      </DetailLayout>
    </article>
  );
}
