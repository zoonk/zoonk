"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { signWithPasskey } from "@zoonk/auth/passkey-browser";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Button } from "@zoonk/ui/components/button";
import { EnterButton, EnterLink, type EnterLinkHostProps } from "@zoonk/ui/components/enter-button";
import { Input } from "@zoonk/ui/components/input";
import { safeAsync } from "@zoonk/utils/error";
import { PlayIcon, Undo2Icon, XIcon } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  type ApprovalOutcome,
  approveContentFixesAction,
  rejectContentFixAction,
  rejectContentFixBatchAction,
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

type Selection = { batchId: string; fixIds: string[] };

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

/** Passkeys are added in Main's settings, another app, so a plain link. */
function SettingsLink({ children, ...props }: EnterLinkHostProps) {
  return <a {...props}>{children}</a>;
}

function RejectButton() {
  const status = useFormStatus();

  return (
    <Button busy={status.pending} size="xl" type="submit" variant="outline">
      Reject
    </Button>
  );
}

export function RejectForm({ fixId }: { fixId: string }) {
  const [, formAction] = useAdminActionState({
    action: rejectContentFixAction,
    initialState: INITIAL_STATE,
  });

  return (
    <form action={formAction} className="contents">
      <input name="fixId" type="hidden" value={fixId} />
      <RejectButton />
    </form>
  );
}

function rejectedNotice(rejected: number | null): string | null {
  if (rejected === null) {
    return null;
  }

  if (rejected === 0) {
    return "Nothing was left to reject.";
  }

  return rejected === 1 ? "Rejected 1 fix." : `Rejected ${String(rejected)} fixes.`;
}

/**
 * Rejects every fix of the batch still waiting for review; one that's approved, applied or stale
 * keeps where it stands. It stays on the page once nothing waits, so its count stays readable.
 */
export function RejectBatchForm({ batchId, label }: { batchId: string; label: string | null }) {
  const [state, formAction] = useAdminActionState({
    action: rejectContentFixBatchAction,
    initialState: { ...INITIAL_STATE, rejected: null },
  });

  const notice = rejectedNotice(state.rejected);

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <form action={formAction}>
          <input name="batchId" type="hidden" value={batchId} />
          <AdminActionSubmitButton icon={<XIcon />} size="lg">
            {label}
          </AdminActionSubmitButton>
        </form>
      )}

      <p aria-live="polite" className="text-sm empty:hidden" key={state.submissionId}>
        {notice}
      </p>
    </div>
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
 * The page's one decision, in the shared bottom bar: reject, or approve with a passkey. Without a
 * passkey the main action is the way to add one. What an approval couldn't do shows over the bar.
 * Approving applies only the fixes the approver read here: the challenge their passkey signs is
 * stored on exactly `fixIds`. With no `fixIds` (a fix still waiting for its clip) only Reject shows.
 */
export function ReviewBar({
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
    <BottomBar
      note={
        notice ? (
          <p className="text-destructive-text" role="alert">
            {NOTICES[notice]}
          </p>
        ) : null
      }
    >
      <BottomBarActions>
        {rejectFixId && <RejectForm fixId={rejectFixId} />}

        {fixIds.length > 0 && needsPasskey && (
          <EnterLink href={settingsUrl} link={SettingsLink} size="xl">
            Add a passkey to approve
          </EnterLink>
        )}

        {fixIds.length > 0 && !needsPasskey && (
          <form action={approveAction} className="contents">
            <EnterButton busy={isApproving} size="xl" type="submit">
              {approveLabel}
            </EnterButton>
          </form>
        )}
      </BottomBarActions>
    </BottomBar>
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

  // React resets uncontrolled fields after a form action, and a refused undo keeps what was typed.
  // An accepted one opens the new fix's page.
  const [reason, setReason] = useState("");

  const [, formAction] = useAdminActionState({
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
          <Input
            id={reasonId}
            maxLength={2000}
            name="reason"
            onChange={(event) => setReason(event.target.value)}
            required
            value={reason}
          />
        </div>
        <AdminActionSubmitButton icon={<Undo2Icon />} size="lg">
          Propose undoing it
        </AdminActionSubmitButton>
      </form>

      <p className="text-muted-foreground text-sm text-pretty">
        Undoing is a new fix that puts back what this one replaced. It waits for review and changes
        nothing until it&apos;s approved with a passkey.
      </p>
    </div>
  );
}
