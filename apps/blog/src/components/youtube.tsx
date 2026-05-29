import { YouTubeEmbed } from "@next/third-parties/google";

type YouTubeProps = { id: string };

/**
 * Keeps MDX posts using a short `<YouTube id="..." />` API while Next's optimized embed
 * delays the real YouTube iframe until the reader chooses to play the video.
 */
export function YouTube({ id }: YouTubeProps) {
  return (
    <div className="not-prose my-6 w-full overflow-hidden rounded-lg">
      <YouTubeEmbed videoid={id} playlabel="Play YouTube video" />
    </div>
  );
}
