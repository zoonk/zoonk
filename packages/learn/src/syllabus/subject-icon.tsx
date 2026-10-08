import { cn } from "@zoonk/ui/lib/utils";
import { LibraryBigIcon } from "lucide-react";
import { KindTile } from "../_components/kind-tile";

const IMAGE_SIZE = { lg: 64, md: 44, sm: 32 } as const;

const IMAGE_CLASS = {
  lg: "size-16 rounded-2xl",
  md: "size-11 rounded-xl",
  sm: "size-8 rounded-lg",
} as const;

/**
 * A subject's anchor: the icon of the Library course that teaches it, else a tinted tile. Decorative:
 * the subject's name always sits beside it.
 */
export function SubjectIcon({
  imageUrl,
  size = "md",
}: {
  imageUrl: string | null;
  size?: keyof typeof IMAGE_SIZE;
}) {
  if (!imageUrl) {
    return <KindTile icon={LibraryBigIcon} kind="lesson" size={size} />;
  }

  return (
    // oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; course icons are small stored webp files.
    <img
      alt=""
      aria-hidden="true"
      className={cn(
        "shrink-0 bg-white object-cover ring-1 ring-black/5 dark:ring-white/10",
        IMAGE_CLASS[size],
      )}
      data-slot="subject-icon"
      decoding="async"
      height={IMAGE_SIZE[size]}
      src={imageUrl}
      width={IMAGE_SIZE[size]}
    />
  );
}
