import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Suspense } from "react";
import { GalleryNav } from "./_components/gallery-nav";
import { PreviewFrame } from "./_components/preview-frame";
import { ToggleNav } from "./_components/toggle-nav";
import {
  type GallerySelection,
  PREVIEW_DEVICES,
  galleryHref,
  parseGallery,
  previewHref,
} from "./_utils/gallery-params";

const STATE_LABELS = {
  answering: "Answering",
  checked: "Checked",
  explore: "Explore",
  reading: "Reading",
} as const;

const DEVICE_LABELS = { desktop: "Desktop", phone: "Phone" } as const;

async function Gallery({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const selection = parseGallery(await searchParams);

  if (!selection) {
    return null;
  }

  const { device, entry, state } = selection;

  const href = (change: Partial<Pick<GallerySelection, "device" | "state">>) =>
    galleryHref({ device, entry: entry.id, state, ...change });

  const src = previewHref({ entry: entry.id, state });

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <GalleryNav current={entry.id} device={device} />

      <section aria-label={`${entry.label} preview`} className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">{entry.group}</p>
          <h2 className="text-lg font-semibold">{entry.label}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ToggleNav
            label="State"
            options={entry.states.map((option) => ({
              href: href({ state: option }),
              isActive: option === state,
              label: STATE_LABELS[option],
            }))}
          />

          <ToggleNav
            label="Device"
            options={PREVIEW_DEVICES.map((option) => ({
              href: href({ device: option }),
              isActive: option === device,
              label: DEVICE_LABELS[option],
            }))}
          />

          <a
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            href={src}
            rel="noreferrer"
            target="_blank"
          >
            Open alone
          </a>
        </div>

        <PreviewFrame device={device} src={src} title={entry.label} />
      </section>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <Skeleton className="h-96 w-full rounded-xl" />
      <Skeleton className="h-208 w-98 rounded-xl" />
    </div>
  );
}

/**
 * Every screen the lesson player can show, played in the real player from the same fixtures as
 * its browser tests: each activity template explored, answering and checked, each lesson screen
 * kind, pictures and language exercises, on a phone or a desktop, in this computer's light or dark
 * appearance.
 */
export default function GalleryPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Player playground</h1>
        <p className="text-muted-foreground text-sm">
          Every activity, lesson screen and picture as learners see it, from the player&apos;s
          shared fixtures. Nothing here is saved.
        </p>
      </header>

      <Suspense fallback={<GallerySkeleton />}>
        <Gallery searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
