import { type LessonIcon } from "@zoonk/core/library/icons/contract";
import { cn } from "@zoonk/ui/lib/utils";

const SMALL_WIDTH = 96;
const LARGE_WIDTH = 256;

/** Decorative: the words beside an icon always say what it shows, so screen readers skip it. */
export function LessonIconImage({
  className,
  icon,
  size,
}: {
  className?: string;
  icon: LessonIcon;
  size: number;
}) {
  return (
    // oxlint-disable-next-line next/no-img-element -- Icons are stored at both sizes already; srcSet picks one without the optimizer.
    <img
      alt=""
      aria-hidden="true"
      className={cn("pointer-events-none shrink-0 select-none", className)}
      data-slot="lesson-icon"
      decoding="async"
      draggable={false}
      height={size}
      sizes={`${String(size)}px`}
      src={icon.smallUrl}
      srcSet={`${icon.smallUrl} ${String(SMALL_WIDTH)}w, ${icon.url} ${String(LARGE_WIDTH)}w`}
      width={size}
    />
  );
}
