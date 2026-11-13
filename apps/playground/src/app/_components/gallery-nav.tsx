import { previewEntries } from "@zoonk/player/preview/catalog";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";
import { type GallerySelection, galleryHref } from "../_utils/gallery-params";

function groupEntries() {
  const groups = Map.groupBy(previewEntries, (entry) => entry.group);
  return [...groups].map(([group, entries]) => ({ entries, group }));
}

export function GalleryNav({
  current,
  device,
}: Pick<GallerySelection, "device"> & { current: string }) {
  return (
    <nav
      aria-label="Screens"
      className="-mx-2.5 flex flex-col gap-5 px-2.5 max-lg:order-last lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto"
    >
      {groupEntries().map(({ entries, group }) => (
        <div className="flex flex-col gap-1" key={group}>
          <p className="text-muted-foreground text-xs font-medium">{group}</p>

          <ul className="flex flex-col">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  aria-current={entry.id === current ? "page" : undefined}
                  className={cn(
                    "hover:bg-muted -mx-2.5 block truncate rounded-lg px-2.5 py-1 text-sm max-lg:py-3",
                    entry.id === current && "bg-muted",
                  )}
                  href={galleryHref({ device, entry: entry.id })}
                  prefetch
                >
                  {entry.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
