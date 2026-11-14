import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection, AdminSectionSkeleton } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { StateMark } from "@/components/state-mark";
import { getContentFix, rowKeyOf } from "@/data/content-fixes/get-content-fix";
import { formatDate, formatDateTime } from "@/lib/format";
import { languagePairName } from "@/lib/language-filter";
import { LINK_CLASS } from "@/lib/link-class";
import { getMainPageUrl } from "@zoonk/utils/url";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContentFixChanges } from "../_components/content-fix-changes";
import { RevertForm, ReviewBar, ReviewBarSkeleton } from "../_components/content-fix-decision";
import { ContentFixEffects } from "../_components/content-fix-effects";
import { ContentFixTechnicalDetails, proposedFact } from "../_components/content-fix-facts";
import { ContentFixVoice } from "../_components/content-fix-voice";
import {
  contentFixState,
  contentFixStatusLabels,
  contentFixStatusTones,
} from "../content-fix-status";
import { type ContentFixViewer, readContentFixViewer } from "../content-fix-viewer";

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
  return fix.revertsId ? `Undo a fix to ${subject}` : `Fix to ${subject}`;
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

/** The question a "replace" asks instead, or the one a "restore" retires. */
function correctedCopyId(change: ContentFixDetail["changes"][number]): string | null {
  if (change.op === "replace") {
    return change.replacementId;
  }

  return change.op === "restore" && "retires" in change ? change.retires : null;
}

/** Shared content such as a skill or a source has no Admin page: its place is plain text. */
function ContentPlace({ href, place }: { href: string | null; place: string }) {
  if (!place) {
    return "It was deleted after the fix was proposed.";
  }

  return href ? (
    <Link className={LINK_CLASS} href={href} prefetch>
      {place}
    </Link>
  ) : (
    place
  );
}

function Where({ fix }: { fix: ContentFixDetail }) {
  const { adminHref, language, mainUrl, trail } = fix.location;
  const place = trail.join(" › ");

  return (
    <>
      <AdminSection title="Where">
        <DetailFields>
          <DetailField label="Content">
            <ContentPlace href={adminHref} place={place} />
          </DetailField>
          <DetailField label="Language">
            {language ? languagePairName(fix.location) : null}
          </DetailField>
          {mainUrl ? (
            <DetailField label="In Zoonk">
              <a className={LINK_CLASS} href={mainUrl} rel="noreferrer" target="_blank">
                See it as learners do
              </a>
            </DetailField>
          ) : null}
        </DetailFields>
      </AdminSection>

      <ContentFixTechnicalDetails>
        <DetailField label="Fix id">{fix.id}</DetailField>
        {fix.changes.map((change) => (
          <DetailField key={`${rowKeyOf(change)}:${change.op}`} label="Changed row id">
            {change.id}
          </DetailField>
        ))}
        {fix.changes.map(correctedCopyId).map(
          (id) =>
            id && (
              <DetailField key={id} label="Corrected copy id">
                {id}
              </DetailField>
            ),
        )}
        {[...fix.names].map(([id, name]) => (
          <DetailField key={id} label={name}>
            {id}
          </DetailField>
        ))}
      </ContentFixTechnicalDetails>
    </>
  );
}

function Why({ fix }: { fix: ContentFixDetail }) {
  return (
    <AdminSection title="Why">
      <p className="max-w-2xl text-sm leading-6 wrap-break-word whitespace-pre-wrap">
        {fix.reason}
      </p>

      {fix.batchSize > 1 || fix.reverts || fix.feedback ? (
        <DetailFields>
          {fix.batchSize > 1 && (
            <DetailField label="Proposed with">
              <Link className={LINK_CLASS} href={`/content-fixes/batches/${fix.batchId}`} prefetch>
                {fix.batchSize - 1 === 1
                  ? "1 other fix"
                  : `${String(fix.batchSize - 1)} other fixes`}
              </Link>
            </DetailField>
          )}
          {fix.reverts && (
            <DetailField label="Undoes">
              <Link className={LINK_CLASS} href={`/content-fixes/${fix.reverts.id}`} prefetch>
                An earlier fix
              </Link>
            </DetailField>
          )}
          {fix.feedback && (
            <DetailField label="A learner wrote">
              <Link className={LINK_CLASS} href={`/feedback/messages/${fix.feedback.id}`} prefetch>
                Message from {formatDate(fix.feedback.createdAt)}
              </Link>
              <span className="text-muted-foreground mt-1 line-clamp-4 block whitespace-pre-wrap">
                {fix.feedback.message}
              </span>
            </DetailField>
          )}
        </DetailFields>
      ) : null}
    </AdminSection>
  );
}

const OUTCOMES = {
  applied: "Applied. Learners get the changed content.",
  approved: "Approved with a passkey. It hasn't applied yet.",
  rejected: "Rejected. Nothing changed.",
  reverted: "Applied, then undone. Learners get the content from before this fix.",
  stale: "Out of date. Nothing changed.",
  withdrawn: "Withdrawn by whoever proposed it. Nothing changed.",
} as const;

/** What was decided, by whom, and the fixes that undo it. */
function Outcome({ fix, viewer }: { fix: ContentFixDetail; viewer: ContentFixViewer }) {
  const state = contentFixState(fix);

  if (state === "proposed") {
    return null;
  }

  const undoing = fix.revertedBy.filter(
    (revert) => revert.status !== "rejected" && revert.status !== "withdrawn",
  );

  return (
    <AdminSection title="Decision">
      <div className="flex flex-col gap-1 text-sm">
        <StateMark className="font-medium" state={state} tone={contentFixStatusTones[state]}>
          {OUTCOMES[state]}
        </StateMark>
        <p className="text-muted-foreground">
          {[
            fix.status === "stale" ? fix.staleReason : null,
            fix.decider?.name,
            fix.decidedAt ? formatDateTime(fix.decidedAt) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {undoing.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {undoing.map((revert) => (
            <li key={revert.id}>
              <Link className={LINK_CLASS} href={`/content-fixes/${revert.id}`} prefetch>
                The fix that undoes it
              </Link>{" "}
              <span className="text-muted-foreground">
                · {contentFixStatusLabels[revert.status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {state === "applied" && <RevertForm fixId={fix.id} />}
      {fix.status === "approved" && (
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          {fix.deciderId === viewer.id
            ? "Applying stopped before it finished. Finishing needs no passkey."
            : `Applying stopped before it finished. Only ${fix.decider?.name ?? "whoever approved it"} can finish it.`}
        </p>
      )}
    </AdminSection>
  );
}

async function ContentFixContent({ params }: Pick<Props, "params">) {
  const [fix, viewer] = await Promise.all([readFix(params), readContentFixViewer()]);
  const isProposed = fix.status === "proposed";

  return (
    <>
      <AdminDetailHeader
        alert={fix.status === "stale" ? contentFixStatusLabels.stale : null}
        facts={[
          fix.status !== "stale" && contentFixStatusLabels[contentFixState(fix)],
          proposedFact(fix),
        ]}
        parents={FIX_PARENTS}
        title={getTitle(fix)}
      />

      <AdminDetailBody
        bar={
          isProposed || (fix.status === "approved" && fix.deciderId === viewer.id) ? (
            <ReviewBar
              approveLabel="Approve with passkey"
              batchId={fix.batchId}
              finishing={isProposed ? 0 : 1}
              fixIds={isProposed && !fix.voiceOwedAt ? [fix.id] : []}
              hasPasskey={viewer.hasPasskey}
              reject={isProposed ? { fixId: fix.id } : undefined}
              settingsUrl={getMainPageUrl({ locale: "en", path: "/profile" })}
            />
          ) : null
        }
      >
        <AdminDetailColumns aside={<Where fix={fix} />}>
          <Outcome fix={fix} viewer={viewer} />
          <Why fix={fix} />

          <AdminSection title="Changes">
            <ContentFixChanges fix={fix} />
            {fix.status === "proposed" && <ContentFixVoice fix={fix} />}
          </AdminSection>

          <AdminSection title="What else approving does">
            <ContentFixEffects fix={fix} />
          </AdminSection>

          {fix.status === "proposed" && !fix.voiceOwedAt ? (
            <p className="text-muted-foreground text-compact max-w-2xl text-pretty">
              Approving applies exactly the changes above and takes a passkey, so only you can apply
              a fix. Rejecting changes nothing.
            </p>
          ) : null}
        </AdminDetailColumns>
      </AdminDetailBody>
    </>
  );
}

function ContentFixSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton parents={FIX_PARENTS} />

      <AdminDetailBody bar={<ReviewBarSkeleton />}>
        <AdminSectionSkeleton />
        <AdminSectionSkeleton rows={2} />
        <AdminSectionSkeleton description rows={6} />
      </AdminDetailBody>
    </>
  );
}
