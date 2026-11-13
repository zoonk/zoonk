import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection, AdminSectionSkeleton } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { getContentFixBatch } from "@/data/content-fixes/get-content-fix";
import { formatDateTime } from "@/lib/format";
import { getStaffPasskeyStatus } from "@zoonk/core/staff/content-fixes/decide";
import { getMainPageUrl } from "@zoonk/utils/url";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContentFixChanges } from "../../_components/content-fix-changes";
import { RejectForm, ResumeApplying, ReviewDecision } from "../../_components/content-fix-decision";
import { ContentFixEffects } from "../../_components/content-fix-effects";
import { ContentFixVoice } from "../../_components/content-fix-voice";
import {
  ContentFixStatusBadge,
  contentFixState,
  contentFixStatusLabels,
  findAppliedRevert,
} from "../../content-fix-status";

type Props = PageProps<"/content-fixes/batches/[batchId]">;

type BatchFix = NonNullable<Awaited<ReturnType<typeof getContentFixBatch>>>[number];

const BATCH_PARENTS = [{ href: "/content-fixes", label: "Content fixes" }];

async function readBatch(params: Props["params"]) {
  const { batchId } = await params;
  const fixes = isUuid(batchId) ? await getContentFixBatch(batchId) : null;

  if (!fixes) {
    notFound();
  }

  return { batchId, fixes };
}

function getTitle(fixes: readonly BatchFix[]): string {
  return fixes.length === 1 ? "A content fix" : `${String(fixes.length)} content fixes`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fixes } = await readBatch(params);
  return { title: getTitle(fixes) };
}

export default function ContentFixBatchPage({ params }: Props) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<BatchSkeleton />}>
        <BatchContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

/**
 * The reason most fixes share; a fix that gave its own shows it in its card. Null when no two fixes
 * share one: each fix then gave its own reason, and the batch's own reason isn't stored.
 */
function sharedReason(fixes: readonly BatchFix[]): string | null {
  const counts = Map.groupBy(fixes, (fix) => fix.reason);

  const [top] = [...counts.entries()].toSorted(([, left], [, right]) => right.length - left.length);

  return top && (top[1].length > 1 || fixes.length === 1) ? top[0] : null;
}

function statusFacts(fixes: readonly BatchFix[]): string[] {
  const counts = Map.groupBy(fixes, (fix) => contentFixState(fix));

  return [...counts.entries()].map(
    ([state, entries]) =>
      `${String(entries.length)} ${contentFixStatusLabels[state].toLowerCase()}`,
  );
}

function Why({ fixes, reason }: { fixes: readonly BatchFix[]; reason: string | null }) {
  const [first] = fixes;
  const proposedIn = first?.proposerClientId === "admin" ? "Admin" : "the CLI";

  return (
    <AdminSection
      description={
        reason
          ? "Written by whoever proposed the batch. Check it against each fix below."
          : "Each fix below gives its own reason."
      }
      title="Reason"
    >
      {reason && (
        <p className="max-w-3xl leading-7 wrap-break-word whitespace-pre-wrap">{reason}</p>
      )}

      <DetailFields>
        <DetailField label="Proposed by">
          {first?.proposer ? (
            <Link className="hover:underline" href={`/users/${first.proposer.id}`} prefetch>
              {first.proposer.name}
            </Link>
          ) : (
            "Deleted account"
          )}{" "}
          <span className="text-muted-foreground">
            in {proposedIn} · {first ? formatDateTime(first.createdAt) : ""}
          </span>
        </DetailField>
      </DetailFields>
    </AdminSection>
  );
}

function FixCard({ fix, index, reason }: { fix: BatchFix; index: number; reason: string | null }) {
  const revert = findAppliedRevert(fix);

  return (
    <li className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-muted-foreground font-mono text-xs">{index + 1}</span>
        <Link
          className="hit-area relative font-medium hover:underline"
          href={`/content-fixes/${fix.id}`}
          prefetch
        >
          {fix.location.trail.join(" › ") || "Deleted content"}
        </Link>
        <ContentFixStatusBadge state={contentFixState(fix)} />
        {revert && (
          <Link
            className="hit-area relative text-sm underline"
            href={`/content-fixes/${revert.id}`}
            prefetch
          >
            See its revert
          </Link>
        )}
      </div>

      {fix.reason !== reason && (
        <p className="text-sm wrap-break-word whitespace-pre-wrap">{fix.reason}</p>
      )}

      {fix.staleReason && <p className="text-destructive-text text-sm">{fix.staleReason}</p>}

      <ContentFixChanges compact fix={fix} />
      {fix.status === "proposed" && <ContentFixVoice fix={fix} />}
      <ContentFixEffects fix={fix} />

      {fix.status === "proposed" && (
        <div className="flex flex-wrap items-center gap-2">
          <RejectForm fixId={fix.id} />
        </div>
      )}
    </li>
  );
}

async function Decision({ batchId, fixes }: { batchId: string; fixes: readonly BatchFix[] }) {
  const passkey = await getStaffPasskeyStatus();
  const viewerId = passkey.status === "ready" ? passkey.userId : null;
  const waiting = fixes.filter((fix) => fix.status === "proposed");
  const proposed = waiting.filter((fix) => !fix.voiceOwedAt).map((fix) => fix.id);
  const voicing = waiting.length - proposed.length;

  const mine = fixes.filter((fix) => fix.status === "approved" && fix.deciderId === viewerId);

  return (
    <div className="flex flex-col gap-6">
      {mine.length > 0 && <ResumeApplying batchId={batchId} count={mine.length} />}

      {voicing > 0 && (
        <p className="text-muted-foreground text-sm">
          {voicing === 1
            ? "1 fix waits for its new clip and can be approved once it's recorded."
            : `${String(voicing)} fixes wait for their new clips and can be approved once they're recorded.`}
        </p>
      )}

      {proposed.length > 0 && (
        <ReviewDecision
          approveLabel={
            proposed.length === fixes.length
              ? `Approve all ${String(proposed.length)} with passkey`
              : `Approve the remaining ${String(proposed.length)} with passkey`
          }
          batchId={batchId}
          fixIds={proposed}
          hasPasskey={passkey.status === "ready" && passkey.hasPasskey}
          settingsUrl={getMainPageUrl({ locale: "en", path: "/profile" })}
        />
      )}

      {waiting.length === 0 && mine.length === 0 && (
        <p className="text-muted-foreground text-sm">Every fix in this batch is decided.</p>
      )}
    </div>
  );
}

async function BatchContent({ params }: Pick<Props, "params">) {
  const { batchId, fixes } = await readBatch(params);
  const reason = sharedReason(fixes);

  return (
    <>
      <AdminDetailHeader
        facts={statusFacts(fixes)}
        parents={BATCH_PARENTS}
        title={getTitle(fixes)}
      />

      <AdminDetailBody>
        <Why fixes={fixes} reason={reason} />

        <AdminSection
          description="Each fix applies on its own. Reject any you don't want, then approve the rest at once."
          title="Fixes"
        >
          <ol className="flex flex-col gap-4">
            {fixes.map((fix, index) => (
              <FixCard fix={fix} index={index} key={fix.id} reason={reason} />
            ))}
          </ol>
        </AdminSection>

        <AdminSection title="Decision">
          <Decision batchId={batchId} fixes={fixes} />
        </AdminSection>
      </AdminDetailBody>
    </>
  );
}

function BatchSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton parents={BATCH_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton rows={2} />
        <AdminSectionSkeleton description rows={8} />
      </AdminDetailBody>
    </>
  );
}
