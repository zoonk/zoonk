import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection, AdminSectionEmpty, AdminSectionSkeleton } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { getContentFixBatch } from "@/data/content-fixes/get-content-fix";
import { languagePairName } from "@/lib/language-filter";
import { LINK_CLASS } from "@/lib/link-class";
import { getMainPageUrl } from "@zoonk/utils/url";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContentFixChanges } from "../../_components/content-fix-changes";
import { RejectForm, ReviewBar, ReviewBarSkeleton } from "../../_components/content-fix-decision";
import { ContentFixEffects } from "../../_components/content-fix-effects";
import { ContentFixTechnicalDetails, proposedFact } from "../../_components/content-fix-facts";
import { ContentFixVoice } from "../../_components/content-fix-voice";
import { sharedPlace, sharedReason } from "../../content-fix-batch";
import { ContentFixStatusMark, contentFixState, findAppliedRevert } from "../../content-fix-status";
import { readContentFixViewer } from "../../content-fix-viewer";

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

/** Waiting for review, and of those, the ones a passkey can approve now (not waiting for a clip). */
function waitingFixes(fixes: readonly BatchFix[]) {
  const waiting = fixes.filter((fix) => fix.status === "proposed");
  const approvable = waiting.filter((fix) => !fix.voiceOwedAt).map((fix) => fix.id);

  return { approvable, waiting };
}

function batchFacts(fixes: readonly BatchFix[]): string[] {
  const [first] = fixes;
  const { waiting } = waitingFixes(fixes);

  return [
    waiting.length > 0 ? `${String(waiting.length)} waiting for review` : "All decided",
    first ? proposedFact(first) : "",
  ].filter(Boolean);
}

function Where({ batchId, fixes }: { batchId: string; fixes: readonly BatchFix[] }) {
  const place = sharedPlace(fixes.map((fix) => fix.location.trail)).join(" › ");
  const [first] = fixes;

  return (
    <>
      <AdminSection title="Where">
        <DetailFields>
          <DetailField label="Content">{place || "Several places"}</DetailField>
          <DetailField label="Language">
            {first?.location.language ? languagePairName(first.location) : null}
          </DetailField>
        </DetailFields>
      </AdminSection>

      <ContentFixTechnicalDetails>
        <DetailField label="Batch id">{batchId}</DetailField>
      </ContentFixTechnicalDetails>
    </>
  );
}

function fixesDescription({
  fixes,
  mine,
}: {
  fixes: readonly BatchFix[];
  mine: number;
}): string | undefined {
  const { approvable, waiting } = waitingFixes(fixes);
  const recording = waiting.length - approvable.length;

  return (
    [
      waiting.length > 0 &&
        "Each fix applies on its own. Reject the ones you don't want, then approve the rest.",
      recording === 1 && "1 waits for its new clip and can be approved once it's recorded.",
      recording > 1 &&
        `${String(recording)} wait for their new clips and can be approved once they're recorded.`,
      fixes.some((fix) => contentFixState(fix) === "applied") &&
        "To undo an applied fix, open it and propose undoing it.",
      mine > 0 &&
        `${mine === 1 ? "1 fix" : `${String(mine)} fixes`} you approved didn't finish applying. Finish applying completes ${mine === 1 ? "it" : "them"} with no passkey and decides nothing else.`,
    ]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

/**
 * A fix waiting for review shows what it changes; a decided one is its place and outcome, with the
 * rest one tap away on its own page.
 */
function FixRow({ fix, reason }: { fix: BatchFix; reason: string | null }) {
  const revert = findAppliedRevert(fix);
  const isWaiting = fix.status === "proposed";

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            className="hit-area relative font-medium wrap-break-word hover:underline"
            href={`/content-fixes/${fix.id}`}
            prefetch
          >
            {fix.location.trail.join(" › ") || "Deleted content"}
          </Link>
          <p className="text-sm">
            <ContentFixStatusMark state={contentFixState(fix)} />
            {fix.staleReason && <span className="text-muted-foreground"> · {fix.staleReason}</span>}
            {revert && (
              <>
                <span className="text-muted-foreground"> · </span>
                <Link className={LINK_CLASS} href={`/content-fixes/${revert.id}`} prefetch>
                  The fix that undoes it
                </Link>
              </>
            )}
          </p>
        </div>

        {/* 3 px up, so the 30 px button's label shares the title's first line, as in a table row. */}
        {isWaiting && (
          <div className="-mt-0.75 shrink-0">
            <RejectForm fixId={fix.id} size="sm" />
          </div>
        )}
      </div>

      {fix.reason !== reason && (
        <p className="max-w-2xl text-sm leading-6 wrap-break-word whitespace-pre-wrap">
          {fix.reason}
        </p>
      )}

      {isWaiting && (
        <>
          <ContentFixChanges compact fix={fix} />
          <ContentFixVoice fix={fix} />
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs">What else approving does</span>
            <ContentFixEffects fix={fix} />
          </div>
        </>
      )}
    </li>
  );
}

function Fixes({
  fixes,
  mine,
  reason,
}: {
  fixes: readonly BatchFix[];
  mine: number;
  reason: string | null;
}) {
  return (
    <AdminSection description={fixesDescription({ fixes, mine })} title="Fixes">
      <ol className="divide-y border-t">
        {fixes.map((fix) => (
          <FixRow fix={fix} key={fix.id} reason={reason} />
        ))}
      </ol>
    </AdminSection>
  );
}

function rejectFor(fixes: readonly BatchFix[]) {
  const { waiting } = waitingFixes(fixes);
  const [only] = waiting;

  if (!only) {
    return;
  }

  if (fixes.length === 1) {
    return { fixId: only.id };
  }

  return {
    batchId: only.batchId,
    label:
      waiting.length === fixes.length
        ? `Reject all ${String(waiting.length)}`
        : `Reject the remaining ${String(waiting.length)}`,
  };
}

function approveLabel({
  approvable,
  fixes,
}: {
  approvable: readonly string[];
  fixes: readonly BatchFix[];
}): string {
  if (fixes.length === 1) {
    return "Approve with passkey";
  }

  return approvable.length === fixes.length
    ? `Approve all ${String(approvable.length)} with passkey`
    : `Approve the remaining ${String(approvable.length)} with passkey`;
}

async function BatchContent({ params }: Pick<Props, "params">) {
  const [{ batchId, fixes }, viewer] = await Promise.all([
    readBatch(params),
    readContentFixViewer(),
  ]);

  const reason = sharedReason(fixes);
  const { approvable, waiting } = waitingFixes(fixes);
  const mine = fixes.filter((fix) => fix.status === "approved" && fix.deciderId === viewer.id);

  return (
    <>
      <AdminDetailHeader
        facts={batchFacts(fixes)}
        parents={BATCH_PARENTS}
        title={getTitle(fixes)}
      />

      {/* The batch's decision: reject what's left, then approve it with a passkey. With nothing left
          to approve, whoever approved fixes that didn't apply finishes them here. */}
      <AdminDetailBody
        bar={
          waiting.length > 0 || mine.length > 0 ? (
            <ReviewBar
              approveLabel={approveLabel({ approvable, fixes })}
              batchId={batchId}
              finishing={mine.length}
              fixIds={approvable}
              hasPasskey={viewer.hasPasskey}
              reject={rejectFor(fixes)}
              settingsUrl={getMainPageUrl({ locale: "en", path: "/profile" })}
            />
          ) : null
        }
      >
        <AdminDetailColumns aside={<Where batchId={batchId} fixes={fixes} />}>
          <AdminSection title="Why">
            {reason ? (
              <p className="max-w-2xl text-sm leading-6 wrap-break-word whitespace-pre-wrap">
                {reason}
              </p>
            ) : (
              <AdminSectionEmpty>Each fix gives its own reason, below.</AdminSectionEmpty>
            )}
          </AdminSection>

          <Fixes fixes={fixes} mine={mine.length} reason={reason} />
        </AdminDetailColumns>
      </AdminDetailBody>
    </>
  );
}

function BatchSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton parents={BATCH_PARENTS} />

      <AdminDetailBody bar={<ReviewBarSkeleton />}>
        <AdminDetailColumns aside={<AdminSectionSkeleton rows={2} />}>
          <AdminSectionSkeleton rows={2} />
          <AdminSectionSkeleton description rows={8} />
        </AdminDetailColumns>
      </AdminDetailBody>
    </>
  );
}
