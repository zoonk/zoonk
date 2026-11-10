"use client";

import { PlayIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ThemeImage } from "./theme-image";

function useMediaQuery(query: string, serverValue: boolean) {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
    () => serverValue,
  );
}

async function play(video: HTMLVideoElement) {
  try {
    await video.play();
  } catch {
    // The browser may refuse to start it, such as in Low Power Mode; the reader can still tap it.
  }
}

/**
 * A muted, looping clip in light and dark, over its screenshot like `ThemeImage`. Only the clip
 * for the current theme loads, it doesn't start on its own for readers who prefer reduced motion,
 * and tapping it pauses or plays it.
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const dark = useMediaQuery("(prefers-color-scheme: dark)", false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
  const [pausedByReader, setPausedByReader] = useState<boolean>();
  const [playing, setPlaying] = useState(false);
  const clip = dark ? darkSrc : src;
  const shouldPlay = !(pausedByReader ?? reducedMotion);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.getAttribute("src") !== clip) {
      video.src = clip;
    }

    if (shouldPlay) {
      void play(video);
    } else {
      video.pause();
    }
  }, [clip, shouldPlay]);

  function toggle() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setPausedByReader(playing);

    if (playing) {
      video.pause();
    } else {
      void play(video);
    }
  }

  return (
    <>
      <ThemeImage
        alt=""
        className="object-cover"
        darkSrc={darkPoster}
        fill
        sizes="19rem"
        src={poster}
      />

      <video
        aria-label={label}
        className="absolute inset-0 size-full object-cover"
        loop
        muted
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        playsInline
        preload="none"
        ref={videoRef}
      />

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
