"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { FileButton } from "@zoonk/ui/components/file-button";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { UploadIcon } from "lucide-react";
import { useState } from "react";
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
  const [fileName, setFileName] = useState("");

  const [state, formAction] = useAdminActionState<UploadMissingAudioState>({
    action: async (previous, formData) => {
      const next = await uploadMissingAudioAction(previous, formData);

      if (next.status === "success") {
        showSuccessToast("Uploaded.");
        setFileName("");
      }

      return next;
    },
    initialState: INITIAL_STATE,
    onRejected: (previous) => ({ ...previous, status: "error" }),
  });

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input name="resourceId" type="hidden" value={resourceId} />
      <input name="resourceKind" type="hidden" value={resourceKind} />
      <FileButton
        accept="audio/mpeg,audio/mp4,audio/m4a,audio/wav,audio/x-wav,audio/ogg,audio/webm"
        aria-label={`Audio file for ${text}`}
        className="max-w-48"
        key={state.submissionId}
        name="audio"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
        required
        size="sm"
      >
        <span className="truncate">{fileName || "Choose file"}</span>
      </FileButton>
      <AdminActionSubmitButton disabled={!fileName} icon={<UploadIcon />}>
        Upload
      </AdminActionSubmitButton>
    </form>
  );
}
