"use client";

import { type MindMapImage, type MindMapOutline as Outline } from "@zoonk/core/mind-maps/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { cn } from "@zoonk/ui/lib/utils";
import { DownloadIcon, MinusIcon, PlusIcon, ScanIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { toMindMapDownloadHref, toMindMapFileName, toMindMapSrc } from "./_utils/mind-map-urls";
import { MAX_SCALE, fitSide } from "./_utils/pan-zoom";
import { MindMapDescription, useMindMapAlt } from "./mind-map-description";
import { usePanZoom } from "./use-pan-zoom";

const PERCENT = 100;

/** The download link, also used beside the picture on a chapter's page. */
export function MindMapDownloadLink({
  className,
  image,
  label,
  title,
}: {
  className?: string;
  image: MindMapImage;
  /** Shown beside the icon; icon-only when absent, with the label for screen readers. */
  label?: string;
  title: string;
}) {
  const t = useExtracted();

  return (
    <a
      className={className}
      download={toMindMapFileName(title)}
      href={toMindMapDownloadHref(image.url)}
    >
      <DownloadIcon aria-hidden="true" />
      {label ?? <span className="sr-only">{t("Download")}</span>}
    </a>
  );
}

function ZoomControls({
  onFit,
  onZoomIn,
  onZoomOut,
  scale,
}: {
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  scale: number;
}) {
  const t = useExtracted();

  return (
    <div className="flex items-center justify-center gap-2 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <Button disabled={scale <= 1} onClick={onZoomOut} size="icon-bar" variant="outline">
        <MinusIcon aria-hidden="true" />
        <span className="sr-only">{t("Zoom out")}</span>
      </Button>

      <Button
        aria-label={t("Fit to screen")}
        disabled={scale <= 1}
        onClick={onFit}
        size="bar"
        variant="outline"
      >
        <ScanIcon aria-hidden="true" data-icon="inline-start" />
        <span aria-hidden="true" className="tabular-nums">
          {Math.round(scale * PERCENT)}%
        </span>
      </Button>

      <Button disabled={scale >= MAX_SCALE} onClick={onZoomIn} size="icon-bar" variant="outline">
        <PlusIcon aria-hidden="true" />
        <span className="sr-only">{t("Zoom in")}</span>
      </Button>
    </div>
  );
}

function ZoomFrame({
  alt,
  descriptionId,
  image,
  zoom,
}: {
  alt: string;
  /** The map in words, when there is one, as the picture's description. */
  descriptionId: string | undefined;
  image: MindMapImage;
  zoom: ReturnType<typeof usePanZoom>;
}) {
  const { fit, frame, frameProps, view, zoomIn, zoomOut } = zoom;
  const side = fitSide(frame);

  return (
    <>
      <div
        className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
        {...frameProps}
      >
        {side > 0 && (
          // oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; maps are stored, optimized webp files.
          <img
            alt={alt}
            aria-describedby={descriptionId}
            className="absolute top-1/2 left-1/2 max-w-none rounded-sm"
            decoding="async"
            draggable={false}
            height={image.height}
            src={toMindMapSrc(image.url)}
            // Sized rather than scaled, so the browser draws small print sharp at every zoom.
            style={{
              height: side * view.scale,
              transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px)`,
              width: side * view.scale,
            }}
            width={image.width}
          />
        )}
      </div>

      <ZoomControls onFit={fit} onZoomIn={zoomIn} onZoomOut={zoomOut} scale={view.scale} />
    </>
  );
}

/**
 * A mind map full screen, to read its small print: pinch or scroll to zoom, drag to move, a double
 * tap to zoom in or back out, the keyboard too, and buttons for every one of those. The bar closes
 * it (Escape too) and saves the picture. Screen readers hear the picture's short alt and the whole
 * map in words as its description.
 */
export function MindMapViewer({
  image,
  onOpenChange,
  open,
  outline,
  title,
}: {
  image: MindMapImage;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** The map in words; null when only the picture is at hand. */
  outline: Outline | null;
  /** The chapter's title, the viewer's own. */
  title: string;
}) {
  const t = useExtracted();
  const descriptionId = useId();
  const alt = useMindMapAlt({ outline, title });
  const barButton = buttonVariants({ size: "icon-bar", variant: "ghost" });
  const zoom = usePanZoom({ active: open });

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        // Every opening starts fitted.
        if (!isOpen) {
          zoom.fit();
        }

        onOpenChange(isOpen);
      }}
      open={open}
    >
      <DialogPortal>
        <DialogPopup
          className="data-open:animate-in data-open:fade-in data-closed:animate-out data-closed:fade-out fixed inset-0 z-50 flex flex-col duration-150 motion-reduce:animate-none"
          data-slot="mind-map-viewer"
        >
          <header className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <DialogClose render={<Button size="icon-bar" variant="ghost" />}>
              <XIcon aria-hidden="true" />
              <span className="sr-only">{t("Close")}</span>
            </DialogClose>

            <DialogTitle className="min-w-0 flex-1 truncate text-center text-base font-semibold">
              {title}
            </DialogTitle>

            <MindMapDownloadLink className={cn(barButton)} image={image} title={title} />
          </header>

          <DialogDescription className="sr-only">
            {alt} {t("Pinch, scroll or use + and - to zoom; drag or use the arrows to move.")}
          </DialogDescription>
          <MindMapDescription id={descriptionId} outline={outline} />
          <ZoomFrame
            alt={alt}
            descriptionId={outline ? descriptionId : undefined}
            image={image}
            zoom={zoom}
          />
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
