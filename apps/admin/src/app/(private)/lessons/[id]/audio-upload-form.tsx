"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { type GeneratedLessonAudioResource } from "@/data/lessons/get-generated-lesson-audio";
import { Input } from "@zoonk/ui/components/input";
import { UploadIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type UploadLessonAudioState,
  uploadLessonAudioAction,
} from "./_actions/upload-lesson-audio";

const INITIAL_STATE: UploadLessonAudioState = { error: null, status: "idle", submissionId: 0 };

/**
 * Gives each missing resource its own file input and submission state so one
 * upload never blocks or clears a different symbol, word, or sentence row.
 */
export function AudioUploadForm({
  lessonId,
  resource,
}: {
  lessonId: string;
  resource: GeneratedLessonAudioResource;
}) {
  const [state, formAction] = useActionState(uploadLessonAudioAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex min-w-64 flex-col items-end gap-1">
      <input name="lessonId" type="hidden" value={lessonId} />
      <input name="resourceId" type="hidden" value={resource.id} />
      <input name="resourceKind" type="hidden" value={resource.kind} />
      <div className="flex w-full items-center gap-2">
        <Input
          accept="audio/mpeg,audio/mp4,audio/m4a,audio/wav,audio/x-wav,audio/ogg,audio/webm"
          aria-label={`Audio file for ${resource.text}`}
          className="max-w-72"
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
