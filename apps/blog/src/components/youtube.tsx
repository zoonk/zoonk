import { YouTubeEmbed } from "@next/third-parties/google";
import { cn } from "@zoonk/ui/lib/utils";

type YouTubeProps = { id: string };

/** The cover's headline sits in its middle, so the play button waits in a corner instead. */
const PLAY_IN_CORNER_CLASS =
  "[&_.lty-playbtn]:top-auto [&_.lty-playbtn]:right-4 [&_.lty-playbtn]:bottom-4 [&_.lty-playbtn]:left-auto [&_.lty-playbtn]:transform-none";

export function YouTube({ id }: YouTubeProps) {
  return (
    <div className={cn("not-prose my-6 w-full overflow-hidden rounded-xl", PLAY_IN_CORNER_CLASS)}>
      <YouTubeEmbed videoid={id} playlabel="Play YouTube video" />
    </div>
  );
}
