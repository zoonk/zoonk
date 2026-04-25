"use client";

import { type StepImage } from "@zoonk/core/steps/contract/image";
import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@zoonk/ui/components/dialog";
import { cn } from "@zoonk/ui/lib/utils";
import { Maximize2Icon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import Image from "next/image";
import { type MouseEvent, type TouchEvent, useState } from "react";
import { type StepImageFit, StepImageView } from "./step-image";

type ImageSize = {
  height: number;
  width: number;
};

type Rect = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

/**
 * Gives cropped step images an explicit escape hatch without adding visible
 * navigation chrome to every media layout. Mobile keeps the button visible
 * because hover does not exist there, while desktop reveals it on hover/focus.
 */
function StepImageExpandButton() {
  const t = useExtracted();

  return (
    <DialogTrigger
      render={
        <Button
          className="bg-background/85 border-border hover:bg-background absolute top-3 right-3 z-10 opacity-90 shadow-sm backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-focus-within/step-image-stage:opacity-100 sm:group-hover/step-image-stage:opacity-100"
          size="icon-sm"
          variant="outline"
        />
      }
    >
      <Maximize2Icon />
      <span className="sr-only">{t("Open full image")}</span>
    </DialogTrigger>
  );
}

/**
 * Keeps fallback text legible in the expanded image surface. The normal step
 * fallback is tuned for lesson layouts, so the full-screen view keeps only the
 * prompt text without adding another framed state around it.
 */
function StepImageDialogFallback({ prompt }: { prompt: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <span className="text-muted-foreground text-center text-sm font-medium">{prompt}</span>
    </div>
  );
}

/**
 * Measures the loaded image so background clicks can close only when the
 * pointer lands outside the rendered `object-contain` image, not merely
 * outside the full-size `<img>` element.
 */
function StepImageDialogView({
  image,
  onImageSizeChange,
}: {
  image: StepImage;
  onImageSizeChange: (size: ImageSize | null) => void;
}) {
  const [errorUrl, setErrorUrl] = useState<string | null>(null);

  if (!image.url || errorUrl === image.url) {
    return <StepImageDialogFallback prompt={image.prompt} />;
  }

  return (
    <Image
      alt={image.prompt}
      className="object-contain"
      fill
      loading="eager"
      onError={() => {
        setErrorUrl(image.url ?? null);
        onImageSizeChange(null);
      }}
      onLoad={(event) => {
        onImageSizeChange({
          height: event.currentTarget.naturalHeight,
          width: event.currentTarget.naturalWidth,
        });
      }}
      sizes="100vw"
      src={image.url}
    />
  );
}

/**
 * Recreates the rectangle occupied by an `object-contain` image inside a full
 * screen stage. The browser reports pointer events against the full image
 * element box, so this geometry is what lets letterboxed areas behave
 * like dismissible overlay.
 */
function getContainedImageRect({
  containerRect,
  imageSize,
}: {
  containerRect: DOMRect;
  imageSize: ImageSize;
}): Rect {
  const containerRatio = containerRect.width / containerRect.height;
  const imageRatio = imageSize.width / imageSize.height;

  const renderedWidth =
    imageRatio > containerRatio ? containerRect.width : containerRect.height * imageRatio;

  const renderedHeight =
    imageRatio > containerRatio ? containerRect.width / imageRatio : containerRect.height;

  const left = containerRect.left + (containerRect.width - renderedWidth) / 2;
  const top = containerRect.top + (containerRect.height - renderedHeight) / 2;

  return {
    bottom: top + renderedHeight,
    left,
    right: left + renderedWidth,
    top,
  };
}

/**
 * Treats edge clicks as inside the image so tiny rounding differences between
 * browser layout and our object-fit math do not accidentally close the dialog.
 */
function isPointInsideRect({
  clientX,
  clientY,
  rect,
}: {
  clientX: number;
  clientY: number;
  rect: Rect;
}) {
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
}

/**
 * Portal events still bubble through the React tree, so lightbox gestures can
 * otherwise reach the read-step tap navigation wrapper. Stopping them here
 * keeps backdrop taps scoped to dismissing the expanded image.
 */
function stopLightboxNavigationPropagation(event: TouchEvent<HTMLDivElement>) {
  event.stopPropagation();
}

/**
 * Shows the original image with `contain` so learners can inspect anything
 * the immersive player crop hides. The dialog stays visually quiet: one close
 * control, tokenized surfaces, and no additional framing around the image.
 */
function StepImageFullScreenDialog({
  image,
  onDismiss,
}: {
  image: StepImage;
  onDismiss: () => void;
}) {
  const t = useExtracted();
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);

  const handleDialogClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (!imageSize) {
      onDismiss();
      return;
    }

    const containedImageRect = getContainedImageRect({
      containerRect: event.currentTarget.getBoundingClientRect(),
      imageSize,
    });

    const isImageClick = isPointInsideRect({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: containedImageRect,
    });

    if (!isImageClick) {
      onDismiss();
    }
  };

  return (
    <DialogContent
      className="bg-background text-foreground fixed inset-0 top-0 left-0 h-dvh max-w-none translate-x-0 translate-y-0 rounded-none p-0 ring-0 sm:max-w-none"
      onClick={handleDialogClick}
      onTouchEnd={stopLightboxNavigationPropagation}
      onTouchMove={stopLightboxNavigationPropagation}
      onTouchStart={stopLightboxNavigationPropagation}
      showCloseButton={false}
    >
      <DialogHeader className="sr-only">
        <DialogTitle>{t("Full image")}</DialogTitle>
        <DialogDescription>{t("Shows the full uncropped step image.")}</DialogDescription>
      </DialogHeader>

      <div
        className="relative h-full min-h-0 w-full p-3 sm:p-6"
        data-slot="step-image-dialog-stage"
      >
        <StepImageDialogView image={image} onImageSizeChange={setImageSize} />
      </div>

      <DialogClose
        render={
          <Button
            className="bg-background/85 hover:bg-background absolute top-4 right-4 shadow-sm backdrop-blur-sm"
            size="icon-sm"
            variant="outline"
          />
        }
      >
        <XIcon />
        <span className="sr-only">{t("Close full image")}</span>
      </DialogClose>
    </DialogContent>
  );
}

/**
 * Shared media stage for player images that are allowed to crop in the normal
 * lesson view. Layout components decide the size and border radius with
 * `className`; this component owns rendering, fallback, and full-image access.
 */
export function ExpandableStepImageStage({
  className,
  fit = "cover",
  image,
}: {
  className?: string;
  fit?: StepImageFit;
  image: StepImage;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <div
        className={cn(
          "group/step-image-stage bg-muted relative h-full w-full overflow-hidden",
          className,
        )}
        data-slot="expandable-step-image-stage"
      >
        <StepImageView fit={fit} image={image} />
        <StepImageExpandButton />
      </div>

      <StepImageFullScreenDialog image={image} onDismiss={() => setOpen(false)} />
    </Dialog>
  );
}
