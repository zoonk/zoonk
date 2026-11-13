import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection, AdminSectionSkeleton } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { getContentFix } from "@/data/content-fixes/get-content-fix";
import { capitalize, formatDateTime } from "@/lib/format";
import { getStaffPasskeyStatus } from "@zoonk/core/staff/content-fixes/decide";
import { getEnvironment } from "@zoonk/utils/environment";
import { MAIN_URL, getMainPageUrl } from "@zoonk/utils/url";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContentFixChanges } from "../_components/content-fix-changes";
import {
  RejectForm,
  ResumeApplying,
  RevertForm,
  ReviewDecision,
} from "../_components/content-fix-decision";
import { ContentFixEffects } from "../_components/content-fix-effects";
import { ContentFixVoice } from "../_components/content-fix-voice";
import { contentFixState, contentFixStatusLabels } from "../content-fix-status";

type Props = PageProps<"/content-fixes/[fixId]">;

type ContentFixDetail = NonNullable<Awaited<ReturnType<typeof getContentFix>>>;

const FIX_PARENTS = [{ href: "/content-fixes", label: "Content fixes" }];

async function readFix(params: Props["params"]): Promise<ContentFixDetail> {
  const { fixId } = await params;
  const fix = isUuid(fixId) ? await getContentFix(fixId) : null;

  if (!fix) {
    notFound();
  }

  return fix;
}

function getTitle(fix: ContentFixDetail): string {
  const subject = fix.location.trail.at(-1) ?? "deleted content";
  return fix.revertsId ? `Revert a fix to ${subject}` : `Fix to ${subject}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getTitle(await readFix(params)) };
}

export default function ContentFixPage({ params }: Props) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<ContentFixSkeleton />}>
        <ContentFixContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

function Where({ fix }: { fix: ContentFixDetail }) {
  const { adminHref, language, mainUrl, trail } = fix.location;
  const place = trail.join(" › ");

  return (
    <AdminSection title="Where">
      <DetailFields>
        <DetailField label="Environment">
          {capitalize(getEnvironment())} · {new URL(MAIN_URL).host}
        </DetailField>
        <DetailField label="Content">
          {adminHref ? (
            <Link className="hover:underline" href={adminHref} prefetch>
              {place}
            </Link>
          ) : (
            place || "This content was deleted after the fix was proposed."
          )}
        </DetailField>
        <DetailField label="Language">{language?.toUpperCase() ?? "—"}</DetailField>
        <DetailField label="In Zoonk">
          {mainUrl ? (
            <a className="underline" href={mainUrl} rel="noreferrer" target="_blank">
              See it as learners do
            </a>
          ) : (
            "—"
          )}
        </DetailField>
      </DetailFields>
    </AdminSection>
  );
}

function Why({ fix }: { fix: ContentFixDetail }) {
  const proposedIn = fix.proposerClientId === "admin" ? "Admin" : "the CLI";

  return (
    <AdminSection
      description={
        fix.proposerClientId === "admin"
          ? undefined
          : "Written by the agent that proposed the fix. Check it against the changes below."
      }
      title={fix.proposerClientId === "admin" ? "Reason" : "The agent's reason"}
    >
      <p className="max-w-3xl leading-7 wrap-break-word whitespace-pre-wrap">{fix.reason}</p>

      <DetailFields>
        <DetailField label="Proposed by">
          {fix.proposer ? (
            <Link className="hover:underline" href={`/users/${fix.proposer.id}`} prefetch>
              {fix.proposer.name}
            </Link>
          ) : (
            "Deleted account"
          )}{" "}
          <span className="text-muted-foreground">
            in {proposedIn} · {formatDateTime(fix.createdAt)}
          </span>
        </DetailField>
        {fix.batchSize > 1 && (
          <DetailField label="Batch">
            <Link className="underline" href={`/content-fixes/batches/${fix.batchId}`} prefetch>
              All {fix.batchSize} fixes proposed with it
            </Link>
          </DetailField>
        )}
        {fix.reverts && (
          <DetailField label="Reverts">
            <Link className="underline" href={`/content-fixes/${fix.reverts.id}`} prefetch>
              The fix this one undoes
            </Link>
          </DetailField>
        )}
        {fix.feedback && (
          <DetailField label="Learner feedback">
            <Link className="underline" href={`/feedback/messages/${fix.feedback.id}`} prefetch>
              Message from {formatDateTime(fix.feedback.createdAt)}
            </Link>
            <span className="text-muted-foreground mt-1 line-clamp-4 block whitespace-pre-wrap">
              {fix.feedback.message}
            </span>
          </DetailField>
        )}
      </DetailFields>
    </AdminSection>
  );
}

function Outcome({ fix, viewerId }: { fix: ContentFixDetail; viewerId: string | null }) {
  const decided = [fix.decider?.name, formatDateTime(fix.decidedAt)].filter(Boolean).join(" · ");

  const reverts = fix.revertedBy.filter(
    (revert) => revert.status !== "rejected" && revert.status !== "withdrawn",
  );

  const state = contentFixState(fix);

  const messages = {
    applied: "Applied. Learners get the changed content.",
    approved: "Approved with a passkey. It hasn't applied yet.",
    rejected: "Rejected. Nothing changed.",
    reverted: "Applied, then reverted. Learners get the content from before this fix.",
    stale: `Stale. Nothing changed. ${fix.staleReason ?? ""}`,
    withdrawn: "Withdrawn by whoever proposed it. Nothing changed.",
  };

  if (state === "proposed") {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {messages[state]} <span className="text-muted-foreground">{decided}</span>
      </p>

      {reverts.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {reverts.map((revert) => (
            <li key={revert.id}>
              <Link className="underline" href={`/content-fixes/${revert.id}`} prefetch>
                Its revert
              </Link>{" "}
              <span className="text-muted-foreground">
                · {contentFixStatusLabels[revert.status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {state === "applied" && <RevertForm fixId={fix.id} />}
      {fix.status === "approved" && fix.deciderId === viewerId && (
        <ResumeApplying batchId={fix.batchId} count={1} />
      )}
    </div>
  );
}

async function Decision({ fix }: { fix: ContentFixDetail }) {
  const passkey = await getStaffPasskeyStatus();
  const viewerId = passkey.status === "ready" ? passkey.userId : null;

  if (fix.status !== "proposed") {
    return <Outcome fix={fix} viewerId={viewerId} />;
  }

  if (fix.voiceOwedAt) {
    return (
      <div className="flex flex-col gap-4">
        <ContentFixVoice fix={fix} />
        <RejectForm fixId={fix.id} />
      </div>
    );
  }

  return (
    <ReviewDecision
      approveLabel="Approve with passkey"
      batchId={fix.batchId}
      fixIds={[fix.id]}
      hasPasskey={passkey.status === "ready" && passkey.hasPasskey}
      rejectFixId={fix.id}
      settingsUrl={getMainPageUrl({ locale: "en", path: "/profile" })}
    />
  );
}

async function ContentFixContent({ params }: Pick<Props, "params">) {
  const fix = await readFix(params);

  return (
    <>
      <AdminDetailHeader
        alert={fix.status === "stale" ? contentFixStatusLabels.stale : null}
        facts={[
          fix.status !== "stale" && contentFixStatusLabels[contentFixState(fix)],
          `Proposed ${formatDateTime(fix.createdAt)}`,
        ]}
        parents={FIX_PARENTS}
        title={getTitle(fix)}
      />

      <AdminDetailBody>
        <Where fix={fix} />
        <Why fix={fix} />

        <AdminSection
          description="Each value as the server read it when the fix was proposed, and as approving writes it."
          title="Changes"
        >
          <ContentFixChanges fix={fix} />
          {fix.status === "proposed" && !fix.voiceOwedAt && <ContentFixVoice fix={fix} />}
        </AdminSection>

        <AdminSection title="What else approving does">
          <ContentFixEffects fix={fix} />
        </AdminSection>

        <AdminSection title="Decision">
          <Decision fix={fix} />
        </AdminSection>
      </AdminDetailBody>
    </>
  );
}

function ContentFixSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton parents={FIX_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton />
        <AdminSectionSkeleton rows={2} />
        <AdminSectionSkeleton description rows={6} />
      </AdminDetailBody>
    </>
  );
}
