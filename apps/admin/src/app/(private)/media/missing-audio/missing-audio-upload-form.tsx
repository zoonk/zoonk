"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { Input } from "@zoonk/ui/components/input";
import { UploadIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type MissingAudioResourceKind,
  type UploadMissingAudioState,
  uploadMissingAudioAction,
} from "./_actions/upload-missing-audio";

const INITIAL_STATE: UploadMissingAudioState = { error: null, status: "idle", submissionId: 0 };

/**
 * Each row has its own file input and submission state, so one upload never
 * blocks or clears another word or sentence.
 */
export function MissingAudioUploadForm({
  resourceId,
  resourceKind,
  text,
}: {
  resourceId: string;
  resourceKind: MissingAudioResourceKind;
  text: string;
}) {
  const [state, formAction] = useActionState(uploadMissingAudioAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex min-w-64 flex-col items-end gap-1">
      <input name="resourceId" type="hidden" value={resourceId} />
      <input name="resourceKind" type="hidden" value={resourceKind} />
      <div className="flex w-full items-center justify-end gap-2">
        <Input
          accept="audio/mpeg,audio/mp4,audio/m4a,audio/wav,audio/x-wav,audio/ogg,audio/webm"
          aria-label={`Audio file for ${text}`}
          className="max-w-64"
          key={state.submissionId}
          name="audio"
          required
          type="file"
        />
        <AdminActionSubmitButton icon={<UploadIcon />}>
          {state.status === "success" ? "Uploaded" : "Upload"}
        </AdminActionSubmitButton>
      </div>
      <span
        aria-live="polite"
        className="text-destructive max-w-80 text-right text-xs empty:hidden"
        key={state.submissionId}
      >
        {state.error}
      </span>
    </form>
  );
}
