import { type ContentFixDetail } from "@/data/content-fixes/get-content-fix";

/** The clip a word or sentence fix recorded for its text, which approving writes with it. */
export function ContentFixVoice({ fix }: { fix: Pick<ContentFixDetail, "voice" | "voiceOwedAt"> }) {
  if (fix.voice?.status === "voiced") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">New clip of “{fix.voice.text}”</span>
        <audio className="w-full max-w-md" controls preload="none" src={fix.voice.url}>
          <track kind="captions" />
        </audio>
      </div>
    );
  }

  if (fix.voice?.status === "failed") {
    return (
      <p className="text-destructive-text text-sm">
        The new clip couldn&apos;t be recorded, so this fix can&apos;t be approved. Reject it and
        propose it again.
      </p>
    );
  }

  return fix.voiceOwedAt ? (
    <p className="text-muted-foreground text-sm">
      Recording the new clip. Reload in a minute to hear it and approve.
    </p>
  ) : null;
}
