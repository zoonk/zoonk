"use client";

import {
  type ChapterMindMapView,
  type MindMapImage,
  type MindMapOutline as Outline,
} from "@zoonk/core/mind-maps/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Maximize2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { MindMapLimitNotice } from "../_components/help-limit-notice";
import { KindTile } from "../_components/kind-tile";
import { Surface } from "../_components/surface";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { toMindMapSrc } from "./_utils/mind-map-urls";
import { type MindMapActions } from "./mind-map-actions";
import { MindMapDescription, useMindMapAlt } from "./mind-map-description";
import { MindMapOutline } from "./mind-map-outline";
import { MindMapDownloadLink, MindMapViewer } from "./mind-map-viewer";
import { type MindMapShown, useMindMapRequest } from "./use-mind-map-request";

const THUMBNAIL_WIDTH = 640;

/**
 * The picture as one button that opens it full screen, with full screen and download under it.
 * Screen readers hear the picture's short alt as the button's name and the whole map in words as
 * its description.
 */
function MindMapPicture({
  image,
  outline,
  title,
}: {
  image: MindMapImage;
  outline: Outline | null;
  title: string;
}) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const alt = useMindMapAlt({ outline, title });
  const action = buttonVariants({ size: "sm", variant: "ghost" });

  return (
    <Surface className="overflow-hidden">
      <MindMapDescription id={descriptionId} outline={outline} />
      <button
        aria-describedby={outline ? descriptionId : undefined}
        className="focus-visible:ring-ring block w-full outline-none focus-visible:ring-2 focus-visible:ring-inset"
        onClick={() => setOpen(true)}
        type="button"
      >
        {/* oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; maps are stored, optimized webp files. */}
        <img
          alt={alt}
          className="aspect-square h-auto w-full object-cover"
          decoding="async"
          height={image.height}
          sizes="(min-width: 1024px) 34rem, 100vw"
          src={toMindMapSrc(image.url)}
          srcSet={`${toMindMapSrc(image.thumbnailUrl)} ${THUMBNAIL_WIDTH}w, ${toMindMapSrc(image.url)} ${image.width}w`}
          width={image.width}
        />
      </button>

      <div className="border-border/60 flex items-center gap-1 border-t px-2 py-1.5">
        <Button onClick={() => setOpen(true)} size="sm" variant="ghost">
          <Maximize2Icon aria-hidden="true" data-icon="inline-start" />
          {t("Full screen")}
        </Button>
        <MindMapDownloadLink className={action} image={image} label={t("Download")} title={title} />
      </div>

      <MindMapViewer
        image={image}
        onOpenChange={setOpen}
        open={open}
        outline={outline}
        title={title}
      />
    </Surface>
  );
}

const STATE_TEXT_CLASS = "text-muted-foreground text-sm text-pretty";

/** What the card says while the map is made, after a failure, or before it's asked for. */
function useStateCopy(shown: MindMapShown) {
  const t = useExtracted();

  if (shown === "generating") {
    return {
      action: null,
      description: t("It takes about half a minute. You can leave this page; it'll be here."),
      title: t("Drawing the mind map…"),
    };
  }

  if (shown === "failed") {
    return {
      action: t("Try again"),
      description: t("The mind map couldn't be made this time."),
      title: t("Mind map"),
    };
  }

  if (shown === "unreachable") {
    return {
      action: t("Try again"),
      description: t("We couldn't reach the server. Check your connection."),
      title: t("Mind map"),
    };
  }

  return {
    action: t("Create the mind map"),
    description: t("The chapter's main ideas in one picture, to review at a glance."),
    title: t("Mind map"),
  };
}

/** A map not drawn yet: what it is and the one tap that makes it, or that it's being made. */
function MindMapRequestCard({
  actions,
  mindMap,
}: {
  actions: MindMapActions;
  mindMap: ChapterMindMapView;
}) {
  const routes = useLearnRoutes();

  const { create, isPending, limit, retry, shown } = useMindMapRequest({
    actions,
    chapterId: mindMap.chapterId,
    status: mindMap.status,
  });

  const copy = useStateCopy(shown);
  const isFailure = shown === "failed" || shown === "unreachable";
  // A cap reached keeps the button in sight, disabled, with the notice's one thing to do under
  // it; a short break keeps it working.
  const isCapped = limit?.status === "limitReached";

  return (
    <Surface className="flex flex-col gap-4 p-4" data-slot="mind-map-request">
      <div className="flex items-start gap-3">
        <KindTile kind="mindMap" />
        <div
          className="flex min-w-0 flex-col gap-0.5"
          role={shown === "generating" ? "status" : undefined}
        >
          <p className="text-[0.9375rem] font-medium">{copy.title}</p>
          <p className={STATE_TEXT_CLASS}>{copy.description}</p>
        </div>
      </div>

      {shown === "generating" && (
        <Spinner
          aria-hidden="true"
          className="text-muted-foreground mx-auto size-5"
          role="presentation"
        />
      )}

      {copy.action && (
        <Button
          className="self-start"
          disabled={isPending || isCapped}
          onClick={isFailure ? retry : create}
          variant={isFailure ? "outline" : "default"}
        >
          {isPending && <Spinner aria-hidden="true" data-icon="inline-start" role="presentation" />}
          {copy.action}
        </Button>
      )}

      {limit && <MindMapLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />}
    </Surface>
  );
}

/**
 * A finished chapter's mind map in its summary: the picture (opening full screen, with a download),
 * or, when its picture failed its text check, the map in words; before it exists, the one tap that
 * makes it and its wait. Nothing for a chapter the learner hasn't finished.
 */
export function MindMapCard({
  actions,
  chapterTitle,
  mindMap,
}: {
  actions: MindMapActions;
  chapterTitle: string;
  mindMap: ChapterMindMapView;
}) {
  const t = useExtracted();

  if (mindMap.status === "unavailable") {
    return null;
  }

  if (mindMap.status !== "ready" || !mindMap.outline) {
    return <MindMapRequestCard actions={actions} mindMap={mindMap} />;
  }

  if (mindMap.image) {
    return <MindMapPicture image={mindMap.image} outline={mindMap.outline} title={chapterTitle} />;
  }

  return (
    <Surface className="flex flex-col gap-4 p-4" data-slot="mind-map-text">
      <p className={STATE_TEXT_CLASS}>
        {t("Its picture had mistakes, so here's the mind map as text.")}
      </p>
      <MindMapOutline outline={mindMap.outline} />
    </Surface>
  );
}
