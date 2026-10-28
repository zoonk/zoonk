import { cn } from "@zoonk/ui/lib/utils";
import { getLanguageFlagCode } from "@zoonk/utils/language-flags";
import { FLAG_IMAGES } from "./_flags/flag-images";

/** flag-icons' 4x3 set; CSS sets the rendered size. */
const FLAG_WIDTH = 640;
const FLAG_HEIGHT = 480;

export function hasLanguageFlag(language: string | null | undefined): language is string {
  return Boolean(language && getLanguageFlagCode(language));
}

export function LanguageFlag({
  alt = "",
  className,
  language,
}: {
  alt?: string;
  className?: string;
  language: string;
}) {
  const code = getLanguageFlagCode(language);

  if (!code) {
    return null;
  }

  const flag = FLAG_IMAGES[code];
  const src = typeof flag === "string" ? flag : flag.src;

  return (
    // oxlint-disable-next-line next/no-img-element -- a flag is a small static SVG with nothing to optimize, and @zoonk/ui doesn't depend on next/image.
    <img
      alt={alt}
      className={cn(
        "aspect-4/3 shrink-0 rounded-[18%/24%] object-cover shadow-xs ring-1 ring-black/10 dark:ring-white/20",
        className,
      )}
      data-slot="language-flag"
      height={FLAG_HEIGHT}
      src={src}
      width={FLAG_WIDTH}
    />
  );
}
