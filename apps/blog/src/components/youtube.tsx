import { YouTubeEmbed } from "@next/third-parties/google";
import { cn } from "@zoonk/ui/lib/utils";

type YouTubeProps = { id: string };

/**
 * The cover's headline sits in its middle. lite-youtube's button covers the whole frame and draws
 * its icon as a centered background, so the icon moves to a corner and the frame stays the target.
 * Its stylesheet loads from a CDN outside Tailwind's layers, so only an important rule overrides it.
 */
const PLAY_IN_CORNER_CLASS = "[&_.lty-playbtn]:[background-position:right_1rem_bottom_1rem]!";

export function YouTube({ id }: YouTubeProps) {
  return (
    <div className={cn("not-prose my-6 w-full overflow-hidden rounded-xl", PLAY_IN_CORNER_CLASS)}>
      <YouTubeEmbed videoid={id} playlabel="Play YouTube video" />
    </div>
  );
}
