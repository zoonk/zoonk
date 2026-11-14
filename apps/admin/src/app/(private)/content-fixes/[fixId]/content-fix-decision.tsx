"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { signWithPasskey } from "@zoonk/auth/passkey-browser";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Button } from "@zoonk/ui/components/button";
import { EnterButton, EnterLink, type EnterLinkHostProps } from "@zoonk/ui/components/enter-button";
import { Input } from "@zoonk/ui/components/input";
import { safeAsync } from "@zoonk/utils/error";
import { Undo2Icon } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  approveContentFixAction,
  rejectContentFixAction,
  revertContentFixAction,
  startContentFixApprovalAction,
} from "./_actions/content-fix-actions";

type ApprovalNotice =
  | "cacheNotNotified"
  | "expired"
  | "failed"
  | "needsPasskey"
  | "notSigned"
  | "refused";

const NOTICES: Record<ApprovalNotice, string> = {
  cacheNotNotified:
    "Applied, but Main wasn't told. It shows the old content until its cache expires, in about 15 minutes.",
  expired: "That took too long, so nothing changed. Approve again.",
  failed: "Couldn't approve. Check that the API is running, then try again.",
  needsPasskey: "You have no passkey yet. Add one, then approve.",
  notSigned: "Your passkey didn't confirm, so nothing changed. Approve again.",
  refused: "That passkey wasn't accepted, so nothing changed. Use one of your own passkeys.",
};

/** Null when the page itself shows what happened: the fix is applied, stale or already decided. */
async function approve(fixId: string): Promise<ApprovalNotice | null> {
  const started = await startContentFixApprovalAction(fixId);

  if (started.status !== "ready") {
    return started.status === "decided" ? null : started.status;
  }

  const assertion = await signWithPasskey(started.options);

  if (!assertion) {
    return "notSigned";
  }

  const outcome = await approveContentFixAction({ assertion, fixId });

  if (outcome.status === "decided") {
    return outcome.cacheNotified === false ? "cacheNotNotified" : null;
  }

  if (outcome.status === "approvalExpired") {
    return "expired";
  }

  return outcome.status === "assertionInvalid" ? "refused" : "failed";
}

const INITIAL_STATE = { error: null, submissionId: 0 };

/** Passkeys are added in Main's settings, another app, so a plain link. */
function SettingsLink({ children, ...props }: EnterLinkHostProps) {
  return <a {...props}>{children}</a>;
}

function RejectForm({ fixId }: { fixId: string }) {
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

function RejectButton() {
  const status = useFormStatus();

  return (
    <Button busy={status.pending} size="xl" type="submit" variant="outline">
      Reject
    </Button>
  );
}

/**
 * The page's one decision, in the shared bottom bar: reject, or approve with a passkey. Without a
 * passkey the main action is the way to add one. What an approval couldn't do shows over the bar.
 */
export function ReviewBar({
  fixId,
  hasPasskey,
  settingsUrl,
}: {
  fixId: string;
  hasPasskey: boolean;
  settingsUrl: string;
}) {
  const [notice, approveAction, isApproving] = useActionState(async () => {
    const { data, error } = await safeAsync(() => approve(fixId));
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
        <RejectForm fixId={fixId} />

        {needsPasskey ? (
          <EnterLink href={settingsUrl} link={SettingsLink} size="xl">
            Add a passkey to approve
          </EnterLink>
        ) : (
          <form action={approveAction} className="contents">
            <EnterButton busy={isApproving} size="xl" type="submit">
              Approve with passkey
            </EnterButton>
          </form>
        )}
      </BottomBarActions>
    </BottomBar>
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
