"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { signWithPasskey } from "@zoonk/auth/passkey-browser";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Button, ButtonSkeleton } from "@zoonk/ui/components/button";
import { EnterButton, EnterLink, type EnterLinkHostProps } from "@zoonk/ui/components/enter-button";
import { Input } from "@zoonk/ui/components/input";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { safeAsync } from "@zoonk/utils/error";
import { Undo2Icon } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  type ApprovalOutcome,
  type BatchRejectState,
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
  | "finishFailed"
  | "needsPasskey"
  | "notSigned"
  | "refused";

const NOTICES: Record<ApprovalNotice, string> = {
  cacheNotNotified:
    "Applied, but Main wasn't told. It shows the old content until its cache expires, in about 15 minutes.",
  changed: "This changed since you opened the page, so nothing was approved. Check it again.",
  expired: "That took too long, so nothing changed. Approve again.",
  failed: "Couldn't approve. Check that the API is running, then try again.",
  finishFailed: "Couldn't finish applying. Check that the API is running, then try again.",
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

function RejectButton({ children, size }: { children: React.ReactNode; size: "sm" | "xl" }) {
  const status = useFormStatus();

  return (
    <Button busy={status.pending} size={size} type="submit" variant="outline">
      {children}
    </Button>
  );
}

/** One fix: in the bar on its own page (`xl`), or on its row of a batch (`sm`). */
export function RejectForm({ fixId, size = "xl" }: { fixId: string; size?: "sm" | "xl" }) {
  const [, formAction] = useAdminActionState({
    action: rejectContentFixAction,
    initialState: INITIAL_STATE,
  });

  return (
    <form action={formAction} className="contents">
      <input name="fixId" type="hidden" value={fixId} />
      <RejectButton size={size}>Reject</RejectButton>
    </form>
  );
}

function rejectedNotice(rejected: number): string {
  if (rejected === 0) {
    return "Nothing was left to reject.";
  }

  return rejected === 1 ? "Rejected 1 fix." : `Rejected ${String(rejected)} fixes.`;
}

/**
 * Rejects every fix of the batch still waiting for review; one that's approved, applied or stale
 * keeps where it stands. The count is a toast, since the bar leaves once nothing waits.
 */
function RejectBatchForm({ batchId, label }: { batchId: string; label: string }) {
  const [, formAction] = useAdminActionState({
    action: async (previous: BatchRejectState, formData: FormData) => {
      const next = await rejectContentFixBatchAction(previous, formData);

      if (next.rejected !== null) {
        showSuccessToast(rejectedNotice(next.rejected));
      }

      return next;
    },
    initialState: { ...INITIAL_STATE, rejected: null },
  });

  return (
    <form action={formAction} className="contents">
      <input name="batchId" type="hidden" value={batchId} />
      <RejectButton size="xl">{label}</RejectButton>
    </form>
  );
}

type Reject = { batchId: string; label: string } | { fixId: string };

/**
 * The page's one decision, in the shared bottom bar: reject, then approve with a passkey (the way
 * to add one, without a passkey). Approving applies only the fixes the approver read here: the
 * challenge their passkey signs is stored on exactly `fixIds`, and it also finishes what they
 * approved before. "Finish applying" finishes the `finishing` fixes the viewer approved that didn't
 * apply, such as after a crash, with no passkey and nothing else decided: the bar's other action
 * beside an approval, its main action when nothing is left to approve. What an action couldn't do
 * shows in the bar's note.
 */
export function ReviewBar({
  approveLabel,
  batchId,
  finishing = 0,
  fixIds,
  hasPasskey,
  reject,
  settingsUrl,
}: Selection & {
  approveLabel: string;
  finishing?: number;
  hasPasskey: boolean;
  reject?: Reject;
  settingsUrl: string;
}) {
  // The note speaks for the action pressed last, so an older one's message never hides it.
  const [lastAction, setLastAction] = useState<"approve" | "finish">("approve");

  const [approveNotice, approveAction, isApproving] = useActionState(async () => {
    setLastAction("approve");
    const { data, error } = await safeAsync(() => approve({ batchId, fixIds }));
    return error ? "failed" : data;
  }, null);

  const [finishNotice, finishAction, isFinishing] = useActionState(async () => {
    setLastAction("finish");
    const { data, error } = await safeAsync(() => resumeContentFixesAction(batchId));
    const notice = error || !data ? "failed" : toNotice(data);
    return notice === "failed" ? "finishFailed" : notice;
  }, null);

  const notice = lastAction === "finish" ? finishNotice : approveNotice;
  const needsPasskey = !hasPasskey || approveNotice === "needsPasskey";

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
        {reject && "fixId" in reject && <RejectForm fixId={reject.fixId} />}
        {reject && "label" in reject && (
          <RejectBatchForm batchId={reject.batchId} label={reject.label} />
        )}

        {finishing > 0 && fixIds.length > 0 && (
          <form action={finishAction} className="contents">
            <Button busy={isFinishing} size="xl" type="submit" variant="outline">
              Finish applying
            </Button>
          </form>
        )}

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

        {finishing > 0 && fixIds.length === 0 && (
          <form action={finishAction} className="contents">
            <EnterButton busy={isFinishing} size="xl" type="submit">
              Finish applying
            </EnterButton>
          </form>
        )}
      </BottomBarActions>
    </BottomBar>
  );
}

/** Holds the bar's height while the passkey read streams, so nothing moves when it lands. */
export function ReviewBarSkeleton() {
  return (
    <BottomBar aria-hidden="true">
      <BottomBarActions>
        <ButtonSkeleton size="xl" variant="outline">
          Reject
        </ButtonSkeleton>
        <ButtonSkeleton size="xl">Approve with passkey</ButtonSkeleton>
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
