import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminDisclosure } from "@/components/admin-json";
import { AdminSection, AdminSectionSkeleton } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { StateMark } from "@/components/state-mark";
import { type ContentFixDetail, getContentFix } from "@/data/content-fixes/get-content-fix";
import { capitalize, formatDate, formatDateTime } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { getStaffPasskeyStatus } from "@zoonk/core/staff/content-fixes/decide";
import { getEnvironment } from "@zoonk/utils/environment";
import { MAIN_URL, getMainPageUrl } from "@zoonk/utils/url";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { contentFixStatusLabels } from "../content-fix-status";
import { ContentFixChanges } from "./content-fix-changes";
import { RevertForm, ReviewBar } from "./content-fix-decision";
import { ContentFixEffects } from "./content-fix-effects";

type Props = PageProps<"/content-fixes/[fixId]">;

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

const LINK_CLASS = "hit-area relative underline underline-offset-3";

function Where({ fix }: { fix: ContentFixDetail }) {
  const { adminHref, language, mainUrl, trail } = fix.location;
  const place = trail.join(" › ");

  return (
    <>
      <AdminSection title="Where">
        <DetailFields>
          <DetailField label="Content">
            {adminHref && place ? (
              <Link className={LINK_CLASS} href={adminHref} prefetch>
                {place}
              </Link>
            ) : (
              "It was deleted after the fix was proposed."
            )}
          </DetailField>
          <DetailField label="Language">{language ? languageName(language) : null}</DetailField>
          {mainUrl ? (
            <DetailField label="In Zoonk">
              <a className={LINK_CLASS} href={mainUrl} rel="noreferrer" target="_blank">
                See it as learners do
              </a>
            </DetailField>
          ) : null}
        </DetailFields>
      </AdminSection>

      <AdminDisclosure label="Technical details">
        <div className="pb-2 text-sm">
          <DetailFields>
            <DetailField label="Environment" mono={false}>
              {capitalize(getEnvironment())} · {new URL(MAIN_URL).host}
            </DetailField>
            <DetailField label="Fix id">{fix.id}</DetailField>
            {fix.changes.map((change) => (
              <DetailField key={`${change.id}:${change.op}`} label="Changed row id">
                {change.id}
              </DetailField>
            ))}
          </DetailFields>
        </div>
      </AdminDisclosure>
    </>
  );
}

function Why({ fix }: { fix: ContentFixDetail }) {
  return (
    <AdminSection title="Why">
      <p className="max-w-2xl text-sm leading-6 wrap-break-word whitespace-pre-wrap">
        {fix.reason}
      </p>

      {fix.reverts || fix.feedback ? (
        <DetailFields>
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
  applied: { title: "Applied. Learners get the changed content.", tone: "done" },
  rejected: { title: "Rejected. Nothing changed.", tone: "off" },
  stale: { title: "Out of date. Nothing changed.", tone: "attention" },
} as const;

/** What was decided, by whom, and the fixes that undo it. */
function Outcome({ fix }: { fix: ContentFixDetail }) {
  if (fix.status === "proposed") {
    return null;
  }

  const outcome = OUTCOMES[fix.status];
  const undoing = fix.revertedBy.filter((revert) => revert.status !== "rejected");

  return (
    <AdminSection title="Decision">
      <div className="flex flex-col gap-1 text-sm">
        <StateMark className="font-medium" state={fix.status} tone={outcome.tone}>
          {outcome.title}
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

      {fix.status === "applied" && <RevertForm fixId={fix.id} />}
    </AdminSection>
  );
}

async function ReviewBarSlot({ fix }: { fix: ContentFixDetail }) {
  const passkey = await getStaffPasskeyStatus();

  return (
    <ReviewBar
      fixId={fix.id}
      hasPasskey={passkey.status === "ready" && passkey.hasPasskey}
      settingsUrl={getMainPageUrl({ locale: "en", path: "/profile" })}
    />
  );
}

async function ContentFixContent({ params }: Pick<Props, "params">) {
  const fix = await readFix(params);
  const proposedIn = fix.proposerClientId === "admin" ? "Admin" : "the CLI";

  return (
    <>
      <AdminDetailHeader
        alert={fix.status === "stale" ? contentFixStatusLabels.stale : null}
        facts={[
          fix.status !== "stale" && contentFixStatusLabels[fix.status],
          `Proposed ${formatDateTime(fix.createdAt)} by ${fix.proposer?.name ?? "a deleted account"} in ${proposedIn}`,
        ]}
        parents={FIX_PARENTS}
        title={getTitle(fix)}
      />

      <AdminDetailBody
        bar={
          fix.status === "proposed" ? (
            <Suspense fallback={null}>
              <ReviewBarSlot fix={fix} />
            </Suspense>
          ) : null
        }
      >
        <AdminDetailColumns aside={<Where fix={fix} />}>
          <Outcome fix={fix} />
          <Why fix={fix} />

          <AdminSection title="Changes">
            <ContentFixChanges fix={fix} />
          </AdminSection>

          <AdminSection title="What else approving does">
            <ContentFixEffects fix={fix} />
          </AdminSection>

          {fix.status === "proposed" ? (
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

      <AdminDetailBody>
        <AdminSectionSkeleton />
        <AdminSectionSkeleton rows={2} />
        <AdminSectionSkeleton description rows={6} />
      </AdminDetailBody>
    </>
  );
}
