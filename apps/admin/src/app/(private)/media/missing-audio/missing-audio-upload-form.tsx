"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { Input } from "@zoonk/ui/components/input";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { UploadIcon } from "lucide-react";
import {
  type MissingAudioResourceKind,
  type UploadMissingAudioState,
  uploadMissingAudioAction,
} from "./_actions/upload-missing-audio";

const INITIAL_STATE: UploadMissingAudioState = { error: null, status: "idle", submissionId: 0 };

export function MissingAudioUploadForm({
  resourceId,
  resourceKind,
  text,
}: {
  resourceId: string;
  resourceKind: MissingAudioResourceKind;
  text: string;
}) {
  const [state, formAction] = useAdminActionState<UploadMissingAudioState>({
    action: async (previous, formData) => {
      const next = await uploadMissingAudioAction(previous, formData);

      if (next.status === "success") {
        showSuccessToast("Uploaded.");
      }

      return next;
    },
    initialState: INITIAL_STATE,
    onRejected: (previous) => ({ ...previous, status: "error" }),
  });

  return (
    <form action={formAction} className="flex min-w-64 items-center justify-end gap-2">
      <input name="resourceId" type="hidden" value={resourceId} />
      <input name="resourceKind" type="hidden" value={resourceKind} />
      <Input
        accept="audio/mpeg,audio/mp4,audio/m4a,audio/wav,audio/x-wav,audio/ogg,audio/webm"
        aria-label={`Audio file for ${text}`}
        className="h-7.5 max-w-64 rounded-md px-2 py-0 text-xs file:h-7 file:text-xs md:text-xs"
        key={state.submissionId}
        name="audio"
        required
        type="file"
      />
      <AdminActionSubmitButton icon={<UploadIcon />}>Upload</AdminActionSubmitButton>
    </form>
  );
}
