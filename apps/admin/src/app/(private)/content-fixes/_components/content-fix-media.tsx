import { StateMark } from "@/components/state-mark";
import { type ContentFixDetail } from "@/data/content-fixes/get-content-fix";
import { type StoredChange } from "@zoonk/core/staff/content-fixes/contract";
import Image from "next/image";
import { CheckAgainButton } from "./check-again-button";
import {
  ClipPlayer,
  type MediaItem,
  PICTURE_HEIGHT,
  PICTURE_WIDTH,
} from "./content-fix-media-item";

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

/** Media a new screen list shows in place: a screen's picture, a word's clip, an idea's icon. */
function shownInPlace(changes: ContentFixDetail["changes"]): Set<string> {
  return new Set(
    changes.flatMap((change) =>
      change.model === "Lesson" && change.op === "setScreens"
        ? (change.mediaLinks ?? []).map((link) => link.key)
        : [],
    ),
  );
}

export function ContentFixMedia({ fix }: { fix: Pick<ContentFixDetail, "changes" | "media"> }) {
  const inPlace = shownInPlace(fix.changes);
  const media = fix.media.filter((item) => !inPlace.has(item.need.key));

  if (media.length === 0) {
    return null;
  }

  const pending = media.some((item) => item.result === null);
  const failed = media.some((item) => item.result === "failed");

  return (
    <div className="flex flex-col gap-2 text-sm">
      {media.map((item) => (
        <MediaPreview item={item} key={item.need.key} />
      ))}
      {failed && <p>Reject this fix and propose it again to prepare its media.</p>}
      {pending && <CheckAgainButton />}
    </div>
  );
}

const MEDIA_WORDS: Record<MediaItem["need"]["kind"], { one: string; many: string; verb: string }> =
  {
    clip: { many: "clips", one: "clip", verb: "record" },
    ideaIcon: { many: "icons", one: "icon", verb: "draw" },
    picture: { many: "pictures", one: "picture", verb: "draw" },
  };

/** "draw 1 picture and 1 icon, record 2 clips": the media still owed, said once per verb. */
function mediaInWords(items: readonly MediaItem[], verb: (base: string) => string): string {
  const counted = (["picture", "ideaIcon", "clip"] as const).flatMap((kind) => {
    const count = items.filter((item) => item.need.kind === kind).length;
    const words = MEDIA_WORDS[kind];

    return count > 0
      ? [{ verb: words.verb, what: `${String(count)} ${count === 1 ? words.one : words.many}` }]
      : [];
  });

  const phrase = [...new Set(counted.map((entry) => entry.verb))]
    .map((base) => {
      const things = counted.filter((entry) => entry.verb === base).map((entry) => entry.what);
      return `${verb(base)} ${things.join(" and ")}`;
    })
    .join(", ");

  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/**
 * Why approving waits, said above the bar while a fix's media is made at proposal time, or
 * what to do when making it failed.
 */
export function MediaWaitingNote({ media }: { media: readonly MediaItem[] }) {
  const failed = media.filter((item) => item.result === "failed");
  const pending = media.filter((item) => item.result === null);

  if (failed.length > 0) {
    return (
      <p>
        <StateMark state="failed">{mediaInWords(failed, (verb) => `couldn't ${verb}`)}</StateMark>
        <span className="text-muted-foreground">. Reject this fix and propose it again.</span>
      </p>
    );
  }

  return (
    <p>
      <StateMark state="running">
        {pending.length > 0
          ? mediaInWords(pending, (verb) => (verb === "draw" ? "drawing" : "recording"))
          : "Preparing its media"}
      </StateMark>
      <span className="text-muted-foreground">
        . You can approve once {pending.length > 1 ? "they're" : "it's"} ready.
      </span>
    </p>
  );
}
