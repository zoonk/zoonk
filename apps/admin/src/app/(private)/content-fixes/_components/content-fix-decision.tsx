"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { signWithPasskey } from "@zoonk/auth/passkey-browser";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { safeAsync } from "@zoonk/utils/error";
import { FingerprintIcon, KeyRoundIcon, PlayIcon, Undo2Icon, XIcon } from "lucide-react";
import { useActionState, useId } from "react";
import {
  type ApprovalOutcome,
  approveContentFixesAction,
  rejectContentFixAction,
  resumeContentFixesAction,
  revertContentFixAction,
  startContentFixApprovalAction,
} from "../_actions/content-fix-actions";

type ApprovalNotice =
  | "cacheNotNotified"
  | "changed"
  | "expired"
  | "failed"
  | "needsPasskey"
  | "notSigned"
  | "refused";

const NOTICES: Record<ApprovalNotice, string> = {
  cacheNotNotified:
    "Applied, but Main wasn't told. It shows the old content until its cache expires, in about 15 minutes.",
  changed: "This changed since you opened the page, so nothing was approved. Check it again.",
  expired: "That took too long, so nothing changed. Approve again.",
  failed: "Couldn't approve. Check that the API is running, then try again.",
  needsPasskey: "You have no passkey yet. Add one, then approve.",
  notSigned: "Your passkey didn't confirm, so nothing changed. Approve again.",
  refused: "That passkey wasn't accepted, so nothing changed. Use one of your own passkeys.",
};

function toNotice(outcome: ApprovalOutcome): ApprovalNotice | null {
  if (outcome.status === "decided") {
    return outcome.cacheNotified === false ? "cacheNotNotified" : null;
  }

  if (outcome.status === "approvalExpired") {
    return "expired";
  }

  return outcome.status === "assertionInvalid" ? "refused" : "failed";
}

/** Null when the page itself shows what happened: each fix applied, went stale or was decided. */
async function approve(selection: Selection): Promise<ApprovalNotice | null> {
  const started = await startContentFixApprovalAction(selection);

  if (started.status !== "ready") {
    return started.status;
  }

  const assertion = await signWithPasskey(started.options);

  if (!assertion) {
    return "notSigned";
  }

  return toNotice(await approveContentFixesAction({ assertion, batchId: selection.batchId }));
}

const INITIAL_STATE = { error: null, submissionId: 0 };

type Selection = { batchId: string; fixIds: string[] };

export function RejectForm({ fixId }: { fixId: string }) {
  const [state, formAction] = useAdminActionState({
    action: rejectContentFixAction,
    initialState: INITIAL_STATE,
  });

  return (
    <>
      <form action={formAction}>
        <input name="fixId" type="hidden" value={fixId} />
        <AdminActionSubmitButton icon={<XIcon />} size="lg">
          Reject
        </AdminActionSubmitButton>
      </form>

      <span
        aria-live="polite"
        className="text-destructive-text basis-full text-sm empty:hidden"
        key={state.submissionId}
      >
        {state.error}
      </span>
    </>
  );
}

function PasskeySetupLink({ settingsUrl }: { settingsUrl: string }) {
  return (
    <a className={buttonVariants({ size: "lg" })} href={settingsUrl}>
      <KeyRoundIcon aria-hidden="true" />
      Add a passkey to approve
    </a>
  );
}

function Notice({ notice }: { notice: ApprovalNotice | null }) {
  return (
    notice &&
    notice !== "needsPasskey" && (
      <p className="text-destructive-text text-sm" role="alert">
        {NOTICES[notice]}
      </p>
    )
  );
}

/**
 * Approving applies only the fixes the approver read here: the challenge their passkey signs is
 * stored on exactly `fixIds`.
 */
export function ReviewDecision({
  approveLabel,
  batchId,
  fixIds,
  hasPasskey,
  rejectFixId,
  settingsUrl,
}: Selection & {
  approveLabel: string;
  hasPasskey: boolean;
  rejectFixId?: string;
  settingsUrl: string;
}) {
  const [notice, approveAction, isApproving] = useActionState(async () => {
    const { data, error } = await safeAsync(() => approve({ batchId, fixIds }));
    return error ? "failed" : data;
  }, null);

  const needsPasskey = !hasPasskey || notice === "needsPasskey";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {needsPasskey ? (
          <PasskeySetupLink settingsUrl={settingsUrl} />
        ) : (
          <form action={approveAction}>
            <Button
              busy={isApproving}
              icon={<FingerprintIcon aria-hidden="true" />}
              size="lg"
              type="submit"
            >
              {approveLabel}
            </Button>
          </form>
        )}

        {rejectFixId && <RejectForm fixId={rejectFixId} />}
      </div>

      <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
        {needsPasskey
          ? "Approving takes a passkey, so only you can apply a fix. Add one in your Zoonk settings, then come back to this page."
          : "Approving applies exactly the changes above, once you confirm with your passkey. Each fix applies on its own, and one whose content changed since it was proposed changes nothing. Rejecting changes nothing."}
      </p>

      <Notice notice={notice} />
    </div>
  );
}

/** For fixes a passkey approved but that didn't finish applying, such as after a crash. */
export function ResumeApplying({ batchId, count }: { batchId: string; count: number }) {
  const [notice, resumeAction, isResuming] = useActionState(async () => {
    const { data, error } = await safeAsync(() => resumeContentFixesAction(batchId));
    return error || !data ? "failed" : toNotice(data);
  }, null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        You approved {count === 1 ? "a fix that hasn't" : `${String(count)} fixes that haven't`}{" "}
        applied yet. Finishing needs no passkey, and nothing else joins them.
      </p>

      <form action={resumeAction}>
        <Button busy={isResuming} icon={<PlayIcon aria-hidden="true" />} size="lg" type="submit">
          Finish applying
        </Button>
      </form>

      <Notice notice={notice} />
    </div>
  );
}

export function RevertForm({ fixId }: { fixId: string }) {
  const reasonId = useId();

  const [state, formAction] = useAdminActionState({
    action: revertContentFixAction,
    initialState: INITIAL_STATE,
  });

  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input name="fixId" type="hidden" value={fixId} />
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={reasonId}>
            Why undo it?
          </label>
          <Input id={reasonId} maxLength={2000} name="reason" required />
        </div>
        <AdminActionSubmitButton icon={<Undo2Icon />} size="lg">
          Propose a revert
        </AdminActionSubmitButton>
      </form>

      <p className="text-muted-foreground text-sm text-pretty">
        A revert is a new fix that puts back what this one replaced. It opens for review and changes
        nothing until it&apos;s approved with a passkey.
      </p>

      <span
        aria-live="polite"
        className="text-destructive-text text-sm empty:hidden"
        key={state.submissionId}
      >
        {state.error}
      </span>
    </div>
  );
}
