"use client";

import YT from "react-youtube";

type YouTubeProps = {
  id: string;
};

/**
 * Responsive YouTube video embed.
 * Client component because react-youtube uses browser APIs.
 */
export function YouTube({ id }: YouTubeProps) {
  return (
    <span className="my-6 block aspect-video">
      <YT
        videoId={id}
        opts={{ height: "100%", width: "100%" }}
        className="h-full w-full overflow-hidden rounded-lg"
      />
    </span>
  );
}
