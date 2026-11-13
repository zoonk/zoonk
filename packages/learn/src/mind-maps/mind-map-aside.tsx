"use client";

import {
  type ChapterMindMapView,
  type MindMapImage,
  type MindMapOutline as Outline,
} from "@zoonk/core/mind-maps/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { Maximize2Icon, PlusIcon, RotateCwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { MindMapLimitNotice } from "../_components/help-limit-notice";
import { KindDot } from "../_components/kind-tile";
import { PlusMark } from "../_components/plus-lock";
import { StatusRegion } from "../_components/status-region";
import { Surface } from "../_components/surface";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { toMindMapSrc } from "./_utils/mind-map-urls";
import { useStateLines } from "./mind-map-copy";
import { MindMapDescription, useMindMapAlt } from "./mind-map-description";
import { MindMapOutline } from "./mind-map-outline";
import { type MindMapSave } from "./mind-map-save-button";
import { MindMapDownloadLink, MindMapViewer } from "./mind-map-viewer";
import { type MindMapRequest } from "./use-mind-map-request";

const THUMBNAIL_WIDTH = 640;
const STATE_TEXT_CLASS = "text-muted-foreground text-sm text-pretty";

function MindMapPicture({
  image,
  outline,
  save,
  title,
}: {
  image: MindMapImage;
  outline: Outline;
  save: MindMapSave;
  title: string;
}) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const alt = useMindMapAlt({ outline, title });
  const action = buttonVariants({ size: "sm", variant: "ghost" });

  return (
    <Surface className="overflow-hidden" data-slot="mind-map-picture">
      <MindMapDescription id={descriptionId} outline={outline} />
      <button
        aria-describedby={descriptionId}
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
          sizes="20rem"
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
        save={save}
        title={title}
      />
    </Surface>
  );
}

function MindMapText({ outline }: { outline: Outline }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-4" data-slot="mind-map-text">
      <p className={STATE_TEXT_CLASS}>
        {t("Its picture had mistakes, so here's the mind map as text.")}
      </p>
      <MindMapOutline outline={outline} titled />
    </div>
  );
}

function StateHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <KindDot className="-translate-y-px" kind="mindMap" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
    </div>
  );
}

function LockedMap() {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <LearnLink
      className="hover:bg-muted/60 focus-visible:ring-ring -mx-2 flex flex-col rounded-lg px-2 py-1.5 outline-none focus-visible:ring-2"
      data-slot="mind-map-locked"
      href={routes.upgrade}
    >
      <StateHeading>
        <p className="text-reading flex items-center justify-between gap-3 font-medium">
          {t("Mind map")}
          <PlusMark className="font-sans" />
        </p>
        <p className={STATE_TEXT_CLASS}>{t("Its main ideas in one picture")}</p>
      </StateHeading>
    </LearnLink>
  );
}

function MapRequest({
  plus,
  request,
  view,
}: {
  plus: boolean;
  request: MindMapRequest;
  view: ChapterMindMapView;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const { create, isPending, limit, retry, shown } = request;
  const { hint, line } = useStateLines({ place: "chapter", plus, shown, view });
  const working = shown === "drawing" || shown === "writingLessons";
  const failure = shown === "failed" || shown === "unreachable";
  const canCreate = shown === "available" || (shown === "refused" && limit?.status === "slowDown");

  return (
    <div className="flex flex-col gap-4" data-slot="mind-map-request">
      <StateHeading>
        <div aria-live="polite" className="flex flex-col gap-0.5">
          <p className="text-reading font-medium">{t("Mind map")}</p>
          {line && <p className={STATE_TEXT_CLASS}>{line}</p>}
          {hint && <p className={STATE_TEXT_CLASS}>{hint}</p>}
        </div>
      </StateHeading>

      {working && (
        <Spinner
          aria-hidden="true"
          className="text-muted-foreground mx-auto size-5"
          role="presentation"
        />
      )}

      {(failure || canCreate) && (
        <Button
          busy={isPending}
          className="self-start"
          icon={failure ? <RotateCwIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
          onClick={failure ? retry : create}
          size="sm"
          variant="outline"
        >
          {failure ? t("Try again") : t("Create")}
        </Button>
      )}

      <StatusRegion>
        {limit && !isPending && (
          <MindMapLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />
        )}
      </StatusRegion>
    </div>
  );
}

/**
 * A chapter's map in its page's sidebar, where there's room for the picture itself. It shows the
 * request the page's row follows, so both say the same thing at once.
 */
export function MindMapAside({
  plus,
  request,
  view,
}: {
  plus: boolean;
  request: MindMapRequest;
  view: ChapterMindMapView;
}) {
  const { shown } = request;

  if (shown === "unavailable") {
    return null;
  }

  if (shown === "plusRequired") {
    return <LockedMap />;
  }

  if (shown === "ready" && view.outline) {
    return view.image ? (
      <MindMapPicture
        image={view.image}
        outline={view.outline}
        save={request.save}
        title={view.title}
      />
    ) : (
      <MindMapText outline={view.outline} />
    );
  }

  return <MapRequest plus={plus} request={request} view={view} />;
}
