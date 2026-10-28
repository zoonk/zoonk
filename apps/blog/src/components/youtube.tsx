import { YouTubeEmbed } from "@next/third-parties/google";

type YouTubeProps = { id: string };

export function YouTube({ id }: YouTubeProps) {
  return (
    <div className="not-prose my-6 w-full overflow-hidden rounded-lg">
      <YouTubeEmbed videoid={id} playlabel="Play YouTube video" />
    </div>
  );
}
