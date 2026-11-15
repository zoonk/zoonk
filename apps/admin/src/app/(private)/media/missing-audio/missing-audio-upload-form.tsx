"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { buttonVariants } from "@zoonk/ui/components/button";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { UploadIcon } from "lucide-react";
import { useId, useState } from "react";
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
  const fileId = useId();
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
      <label className={buttonVariants({ size: "sm", variant: "outline" })} htmlFor={fileId}>
        {fileName || "Upload a file"}
        <input
          accept="audio/mpeg,audio/mp4,audio/m4a,audio/wav,audio/x-wav,audio/ogg,audio/webm"
          aria-label={`Audio file for ${text}`}
          className="sr-only"
          id={fileId}
          key={state.submissionId}
          name="audio"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
          required
          type="file"
        />
      </label>
      <AdminActionSubmitButton icon={<UploadIcon />}>Upload</AdminActionSubmitButton>
    </form>
  );
}
