import { StateMark } from "@/components/state-mark";
import { type ContentFixDetail } from "@/data/content-fixes/get-content-fix";
import { type StoredChange } from "@zoonk/core/staff/content-fixes/contract";
import Image from "next/image";
import { CheckAgainButton } from "./check-again-button";

function ClipPlayer({ url }: { url: string }) {
  return (
    <audio className="w-full max-w-md" controls preload="none" src={url}>
      <track kind="captions" />
    </audio>
  );
}

function restoredClipOf(change: StoredChange) {
  if (change.op === "restoreClip") {
    return { clip: change.after, label: `Puts back the clip of “${change.text}” it had before.` };
  }

  return "clip" in change && change.clip?.after
    ? { clip: change.clip.after, label: "Puts back the clip it had before." }
    : null;
}

export function RestoredClip({ change }: { change: StoredChange }) {
  const restored = restoredClipOf(change);

  if (!restored) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm">{restored.label}</p>
      {restored.clip.audioUrl && <ClipPlayer url={restored.clip.audioUrl} />}
    </div>
  );
}

const IDEA_ICON_SIZE = 96;
const PICTURE_HEIGHT = 270;
const PICTURE_WIDTH = 480;

type MediaItem = ContentFixDetail["media"][number];

function mediaLabel(need: MediaItem["need"]): string {
  switch (need.kind) {
    case "clip":
      return `Clip of “${need.text}”`;
    case "picture":
      return need.alt ?? need.request;
    case "ideaIcon":
      return need.need.description;
    default:
      return need satisfies never;
  }
}

function MediaPreview({ item: { need, result } }: { item: MediaItem }) {
  const label = mediaLabel(need);

  if (result === null) {
    return <StateMark state="running">Preparing {label}</StateMark>;
  }

  if (result === "failed") {
    return <StateMark state="failed">Couldn&apos;t prepare {label}</StateMark>;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      {result.kind === "clip" ? (
        <ClipPlayer url={result.url} />
      ) : (
        <Image
          alt={label}
          className="h-auto max-w-full"
          height={result.kind === "picture" ? PICTURE_HEIGHT : IDEA_ICON_SIZE}
          src={result.url}
          unoptimized
          width={result.kind === "picture" ? PICTURE_WIDTH : IDEA_ICON_SIZE}
        />
      )}
    </div>
  );
}

export function ContentFixMedia({ fix }: { fix: Pick<ContentFixDetail, "media"> }) {
  if (fix.media.length === 0) {
    return null;
  }

  const pending = fix.media.some((item) => item.result === null);
  const failed = fix.media.some((item) => item.result === "failed");

  return (
    <div className="flex flex-col gap-2 text-sm">
      {fix.media.map((item) => (
        <MediaPreview item={item} key={item.need.key} />
      ))}
      {failed && <p>Reject this fix and propose it again to prepare its media.</p>}
      {pending && <CheckAgainButton />}
    </div>
  );
}
