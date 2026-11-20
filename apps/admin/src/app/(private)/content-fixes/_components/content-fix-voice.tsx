import { StateMark } from "@/components/state-mark";
import { type ContentFixDetail } from "@/data/content-fixes/get-content-fix";
import { type StoredChange } from "@zoonk/core/staff/content-fixes/contract";
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

/** The clip a revert puts back as it was, with nothing recorded again. */
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

/**
 * The clip a word or sentence fix recorded for its text, which approving writes with it. The
 * browser's own player: a reviewer replays and scrubs one clip, by mouse or keyboard.
 */
export function ContentFixVoice({ fix }: { fix: Pick<ContentFixDetail, "voice" | "voiceOwedAt"> }) {
  if (fix.voice?.status === "voiced") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">New clip of “{fix.voice.text}”</span>
        <ClipPlayer url={fix.voice.url} />
      </div>
    );
  }

  if (fix.voice?.status === "failed") {
    return (
      <p className="text-sm">
        <StateMark state="failed">The new clip couldn&apos;t be recorded</StateMark>
        <span className="text-muted-foreground">
          , so this fix can&apos;t be approved. Reject it and propose it again.
        </span>
      </p>
    );
  }

  return fix.voiceOwedAt ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <p>
        <StateMark state="running">Recording the new clip</StateMark>
        <span className="text-muted-foreground">. You can approve once it&apos;s ready.</span>
      </p>
      <CheckAgainButton />
    </div>
  ) : null;
}
