import { StateMark } from "@/components/state-mark";
import { type ContentFixDetail } from "@/data/content-fixes/get-content-fix";
import Image from "next/image";
import { CheckAgainButton } from "./check-again-button";

export type MediaItem = ContentFixDetail["media"][number];

export const PICTURE_HEIGHT = 360;
export const PICTURE_WIDTH = 480;
const ICON_SIZE = 24;

export function ClipPlayer({ url }: { url: string }) {
  return (
    <audio className="w-full max-w-md" controls preload="none" src={url}>
      <track kind="captions" />
    </audio>
  );
}

/** A word's or sentence's clip: the one it has, or the one this fix records first. */
export function VocabularyClip({
  audioUrl,
  item,
  text,
}: {
  audioUrl: string | null;
  item?: MediaItem;
  text: string;
}) {
  if (item?.result === null) {
    return <StateMark state="running">Recording a clip of “{text}”</StateMark>;
  }

  if (item?.result === "failed") {
    return <StateMark state="failed">Couldn&apos;t record a clip of “{text}”</StateMark>;
  }

  const url = item?.result.kind === "clip" ? item.result.url : audioUrl;

  if (!url) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">
        {item ? `New clip of “${text}”` : "Clip already in the Library"}
      </span>
      <ClipPlayer url={url} />
    </div>
  );
}

/** A new screen's picture: drawn at proposal time, so the reviewer sees it before approving. */
export function ScreenPicture({ item }: { item: MediaItem }) {
  const { need, result } = item;
  const request = need.kind === "picture" ? need.request : null;

  return (
    <div className="flex flex-col gap-2">
      {result && result !== "failed" && result.kind === "picture" ? (
        <Image
          alt={need.kind === "picture" ? (need.alt ?? need.request) : ""}
          className="bg-muted/50 aspect-4/3 h-auto w-full max-w-xs rounded-xl border object-contain"
          height={PICTURE_HEIGHT}
          src={result.url}
          unoptimized
          width={PICTURE_WIDTH}
        />
      ) : (
        <div className="bg-muted/50 flex aspect-4/3 w-full max-w-xs flex-col items-center justify-center gap-3 rounded-xl border text-sm">
          {result === "failed" ? (
            <StateMark state="failed">Couldn&apos;t draw the picture</StateMark>
          ) : (
            <>
              <StateMark state="running">Drawing the picture</StateMark>
              <CheckAgainButton />
            </>
          )}
        </div>
      )}
      {request && <p className="text-muted-foreground text-xs">Picture asked for: {request}</p>}
    </div>
  );
}

/** A new idea's icon, drawn at proposal time like the other media. */
export function IdeaIcon({ item }: { item: MediaItem }) {
  const { result } = item;

  if (result === null) {
    return <StateMark state="running">Drawing an icon for this idea</StateMark>;
  }

  if (result === "failed") {
    return <StateMark state="failed">Couldn&apos;t draw an icon for this idea</StateMark>;
  }

  return (
    <span className="flex items-center gap-2">
      <Image
        alt=""
        className="size-6 shrink-0 rounded-md"
        height={ICON_SIZE}
        src={result.url}
        unoptimized
        width={ICON_SIZE}
      />
      New icon for this idea
    </span>
  );
}
