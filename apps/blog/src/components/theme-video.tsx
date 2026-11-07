"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function visibleClip(light: HTMLVideoElement | null, dark: HTMLVideoElement | null) {
  return matchMedia("(prefers-color-scheme: dark)").matches ? dark : light;
}

async function play(clip: HTMLVideoElement | null) {
  try {
    await clip?.play();
  } catch {
    // The browser may refuse to start it, such as in Low Power Mode; the reader can still tap it.
  }
}

/**
 * A muted, looping clip in light and dark, like `ThemeImage`. Only the visible one plays, it
 * doesn't start on its own for readers who prefer reduced motion, and tapping it pauses or plays it.
 */
export function ThemeVideo({
  darkPoster,
  darkSrc,
  label,
  poster,
  src,
}: {
  darkPoster: string;
  darkSrc: string;
  label: string;
  poster: string;
  src: string;
}) {
  const lightRef = useRef<HTMLVideoElement>(null);
  const darkRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void play(visibleClip(lightRef.current, darkRef.current));
    }
  }, []);

  function toggle() {
    const clip = visibleClip(lightRef.current, darkRef.current);

    if (playing) {
      clip?.pause();
    } else {
      void play(clip);
    }
  }

  const clips = [
    { className: "dark:hidden", poster, ref: lightRef, src },
    { className: "hidden dark:block", poster: darkPoster, ref: darkRef, src: darkSrc },
  ];

  return (
    <>
      {clips.map((clip) => (
        <video
          aria-label={label}
          className={cn("absolute inset-0 size-full object-cover", clip.className)}
          key={clip.src}
          loop
          muted
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          playsInline
          poster={clip.poster}
          preload="none"
          ref={clip.ref}
          src={clip.src}
        />
      ))}

      <button
        aria-label={playing ? "Pause the clip" : "Play the clip"}
        className="focus-visible:ring-ring absolute inset-0 flex cursor-pointer items-center justify-center rounded-4xl outline-none focus-visible:ring-2 focus-visible:ring-inset"
        onClick={toggle}
        type="button"
      >
        {!playing && (
          <span className="bg-background/85 text-foreground ring-border flex size-14 items-center justify-center rounded-full ring-1 backdrop-blur">
            <PlayIcon aria-hidden className="size-6" />
          </span>
        )}
      </button>
    </>
  );
}
