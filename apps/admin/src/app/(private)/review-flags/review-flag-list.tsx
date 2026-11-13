import { AdminSection, AdminSectionEmpty, AdminSectionSkeleton } from "@/components/admin-section";
import { type AdminReviewFlag, listOpenReviewFlags } from "@/data/review-flags/list-review-flags";
import { formatDate, toWords } from "@/lib/format";
import { getItemLabel } from "@/lib/item-label";
import Link from "next/link";
import { ReviewFlagActions } from "./review-flag-actions";

const LINK_CLASS = "hit-area relative underline-offset-3 hover:underline";

/** The thing itself: a lesson's title, a practice question's own words. */
function FlaggedContent({ flag }: { flag: AdminReviewFlag }) {
  if (flag.lesson) {
    return (
      <>
        <Link className={LINK_CLASS} href={`/lessons/${flag.lesson.id}`} prefetch={false}>
          {flag.lesson.title}
        </Link>
        <span className="text-muted-foreground block text-xs">Lesson</span>
      </>
    );
  }

  if (flag.item) {
    return (
      <>
        <Link
          className={`${LINK_CLASS} line-clamp-2`}
          href={`/items/${flag.item.id}`}
          prefetch={false}
        >
          {getItemLabel(flag.item)}
        </Link>
        <span className="text-muted-foreground block text-xs">
          {["Practice question", flag.item.sourceCitation].filter(Boolean).join(" · ")}
        </span>
      </>
    );
  }

  return "Content that no longer exists";
}

function NoticeFacts({ notice }: { notice: AdminReviewFlag["notice"] }) {
  const exam = notice.examBlueprint;
  const changed = notice.fields.map((field) => toWords(field).toLowerCase()).join(", ");

  return (
    <p className="text-muted-foreground text-compact">
      <Link
        className={`${LINK_CLASS} text-foreground`}
        href={exam ? `/exams/${exam.id}` : `/sources/${notice.source.id}`}
        prefetch={false}
      >
        {exam ? exam.name : notice.source.title}
      </Link>
      {" · "}
      {formatDate(notice.createdAt)}
      {changed ? ` · changed ${changed}` : ""}
    </p>
  );
}

export async function ReviewFlagList() {
  const flags = await listOpenReviewFlags();
  const groups = [...Map.groupBy(flags, (flag) => flag.noticeId).values()];

  if (groups.length === 0) {
    return <AdminSectionEmpty>No content is waiting on a source change.</AdminSectionEmpty>;
  }

  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => {
        const [first] = group;

        return first ? (
          <AdminSection key={first.noticeId} title={first.notice.message}>
            <NoticeFacts notice={first.notice} />

            <ul className="divide-y border-t">
              {group.map((flag) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2.5 text-sm"
                  key={flag.id}
                >
                  <div className="min-w-0 flex-1 basis-64">
                    <FlaggedContent flag={flag} />
                  </div>
                  <ReviewFlagActions flagId={flag.id} />
                </li>
              ))}
            </ul>
          </AdminSection>
        ) : null;
      })}
    </div>
  );
}

export function ReviewFlagListSkeleton() {
  return <AdminSectionSkeleton description rows={3} />;
}
