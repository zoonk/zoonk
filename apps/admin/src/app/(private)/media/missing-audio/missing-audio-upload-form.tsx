"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { AdminSmallInput } from "@/components/admin-small-input";
import { useAdminActionState } from "@/lib/use-admin-action-state";
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
    <form action={formAction} className="flex items-center justify-end gap-2">
      <input name="resourceId" type="hidden" value={resourceId} />
      <input name="resourceKind" type="hidden" value={resourceKind} />
      <AdminSmallInput
        accept="audio/mpeg,audio/mp4,audio/m4a,audio/wav,audio/x-wav,audio/ogg,audio/webm"
        aria-label={`Audio file for ${text}`}
        className="px-2 py-2 text-xs file:h-7 file:text-xs md:text-xs"
        frameClassName="max-w-56"
        key={state.submissionId}
        name="audio"
        required
        type="file"
      />
      <AdminActionSubmitButton icon={<UploadIcon />}>Upload</AdminActionSubmitButton>
    </form>
  );
}
