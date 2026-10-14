"use client";

import { type GoalMindMapView } from "@zoonk/core/mind-maps/contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { NetworkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { MindMapLimitNotice } from "../_components/help-limit-notice";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { toMindMapSrc } from "./_utils/mind-map-urls";
import { type MindMapActions } from "./mind-map-actions";
import { MindMapViewer } from "./mind-map-viewer";
import { useMindMapRequest } from "./use-mind-map-request";

const TILE_CLASS = "aspect-square w-full rounded-option";

/** The chapter's number and name under its tile. */
function TileCaption({ mindMap }: { mindMap: GoalMindMapView }) {
  const t = useExtracted();

  return (
    <span className="flex flex-col gap-0.5 text-left">
      <span className="text-muted-foreground font-mono text-[0.6875rem] leading-4 font-medium tracking-[0.06em] uppercase">
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
            "ring-border bg-card object-cover ring-1 transition-opacity group-hover:opacity-90",
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
            "bg-card ring-border flex flex-col items-center justify-center gap-2 ring-1",
          )}
        >
          <NetworkIcon aria-hidden="true" className="text-muted-foreground size-5" />
          <span className="text-muted-foreground text-[0.8125rem]">{t("As text")}</span>
        </span>
        <TileCaption mindMap={mindMap} />
      </LearnLink>
    </li>
  );
}

/**
 * A chapter without its map yet: the tap that makes it, its wait, or why it didn't come. While the
 * learner's maps are at their plan's cap (`capped`), the page says so once and the tap waits.
 */
function MapRequestTile({
  actions,
  capped,
  mindMap,
}: {
  actions: MindMapActions;
  capped: boolean;
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
  // A cap reached (or a guest asked to create an account) keeps the button in sight, disabled,
  // with the notice's one thing to do under the tile; a short break keeps it working.
  const isCapped = capped || (limit !== null && limit.status !== "slowDown");

  return (
    <li className="flex flex-col gap-2">
      <span
        className={cn(
          TILE_CLASS,
          "border-border flex flex-col items-center justify-center gap-3 border border-dashed p-3 text-center",
        )}
      >
        <NetworkIcon aria-hidden="true" className="text-muted-foreground size-5" />

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
      {limit && !capped && (
        <MindMapLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />
      )}
    </li>
  );
}

export function MapTile({
  actions,
  capped,
  hrefs,
  mindMap,
}: {
  actions: MindMapActions;
  capped: boolean;
  hrefs: { chapter: (chapterId: string) => string };
  mindMap: GoalMindMapView;
}) {
  if (mindMap.status !== "ready") {
    return <MapRequestTile actions={actions} capped={capped} mindMap={mindMap} />;
  }

  return mindMap.image ? (
    <MapPictureTile mindMap={mindMap} />
  ) : (
    <MapInWordsTile href={hrefs.chapter(mindMap.chapterId)} mindMap={mindMap} />
  );
}
