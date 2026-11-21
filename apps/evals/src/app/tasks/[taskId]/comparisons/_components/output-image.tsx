"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { Tabs, TabsList, TabsTrigger } from "@zoonk/ui/components/tabs";
import { XIcon } from "lucide-react";
import { useRef, useState } from "react";

export type ShownImage = { alt: string; label: string; src: string };

function Picture({ className, image }: { className: string; image: ShownImage }) {
  return (
    // oxlint-disable-next-line next/no-img-element -- the compared bytes as the model returned them, never resized or re-encoded
    <img alt={image.alt} className={className} decoding="async" draggable={false} src={image.src} />
  );
}

function PictureSwitch({
  images,
  onShow,
  ref,
  shown,
}: {
  images: ShownImage[];
  onShow: (index: number) => void;
  ref: React.Ref<HTMLDivElement>;
  shown: number | null;
}) {
  if (images.length < 2) {
    return <p className="text-sm font-medium">{shown === null ? null : images[shown]?.label}</p>;
  }

  return (
    <Tabs onValueChange={(value: number) => onShow(value)} ref={ref} value={shown}>
      <TabsList activateOnFocus aria-label="Picture" className="mx-0">
        {images.map((entry, index) => (
          <TabsTrigger key={entry.label} value={index}>
            {entry.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/**
 * The run's pictures over the whole screen, one at a time in one place, so flipping between them
 * shows what changed: a letter, a tint, a frame.
 */
function ImageViewer({
  images,
  onClose,
  onShow,
  shown,
}: {
  images: ShownImage[];
  onClose: () => void;
  onShow: (index: number) => void;
  shown: number | null;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const image = shown === null ? null : images[shown];

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(image)}>
      <DialogPortal>
        <DialogPopup
          className="data-open:animate-in data-open:fade-in data-closed:animate-out data-closed:fade-out fixed inset-0 z-50 flex flex-col gap-2 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] duration-150 motion-reduce:animate-none"
          initialFocus={() =>
            tabsRef.current?.querySelector<HTMLElement>("[aria-selected=true]") ?? true
          }
        >
          <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <DialogClose
              className="justify-self-start"
              render={<Button edge="start" size="icon-bar" variant="ghost" />}
            >
              <XIcon aria-hidden="true" />
              <span className="sr-only">Close</span>
            </DialogClose>

            <PictureSwitch images={images} onShow={onShow} ref={tabsRef} shown={shown} />
          </header>

          <DialogTitle className="sr-only">{image?.alt}</DialogTitle>

          <div className="bg-muted min-h-0 flex-1 overflow-hidden rounded-xl">
            {image && <Picture className="size-full object-contain" image={image} />}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

/**
 * One of a run's pictures, whole on a muted square: a white or tinted background shows where it
 * ends, pictures side by side are one size, and a portrait one reads as portrait. Pressing it opens
 * every picture of the run larger.
 */
export function OutputImage({ images, index }: { images: ShownImage[]; index: number }) {
  const [shown, setShown] = useState<number | null>(null);
  const image = images[index];

  if (!image) {
    return null;
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        className="bg-muted focus-visible:ring-ring/50 block aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl outline-none focus-visible:ring-[3px]"
        onClick={() => setShown(index)}
        type="button"
      >
        <Picture className="size-full object-contain" image={image} />
      </button>

      <ImageViewer images={images} onClose={() => setShown(null)} onShow={setShown} shown={shown} />
    </>
  );
}
