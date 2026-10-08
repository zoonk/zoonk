import { AdminJson } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { DetailField } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { VoteTotalsLabel } from "@/components/vote-totals";
import { type VoteTotals, readVoteTotals } from "@/data/feedback/get-vote-totals";
import { type LibraryLessonDetail } from "@/data/lessons/get-library-lesson";
import { formatDateTime } from "@/lib/format";
import { libraryLessonStatusLabels } from "@/lib/library-lesson-filters";
import Link from "next/link";
import { LessonHeldBack } from "./lesson-held-back";

type Lesson = LibraryLessonDetail["lesson"];

/** Every chapter the lesson sits in, with its courses; the home chapter gives the URL. */
function LessonChapters({ lesson }: { lesson: Lesson }) {
  if (lesson.chapters.length === 0) {
    return <span className="text-muted-foreground">Not in any chapter</span>;
  }

  return (
    <ul className="flex flex-col items-end gap-1">
      {lesson.chapters.map(({ chapter }) => (
        <li key={chapter.id}>
          {chapter.title}
          <span className="text-muted-foreground text-xs">
            {" · "}
            {chapter.courses.map(({ course }) => course.title).join(", ") || "no course"}
            {chapter.id === lesson.homeChapterId ? " · home" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The lesson's identity and state: writing status, where it's used, the skills it teaches, the
 * outline's provenance, and the spec and summary it was written from.
 */
export function LessonSummary({
  lesson,
  votes,
}: {
  lesson: Lesson;
  votes: Map<string, VoteTotals>;
}) {
  return (
    <AdminSection description={lesson.description} title={lesson.title}>
      <dl>
        <DetailField label="Content">{libraryLessonStatusLabels[lesson.contentStatus]}</DetailField>
        <DetailField label="Held back">
          <LessonHeldBack lesson={lesson} />
        </DetailField>
        <DetailField label="Spec">{libraryLessonStatusLabels[lesson.specStatus]}</DetailField>
        <DetailField label="Language">
          {lesson.language}
          {lesson.targetLanguage ? ` → ${lesson.targetLanguage}` : ""} · {lesson.level} ·{" "}
          {lesson.estimatedMinutes} min
        </DetailField>
        <DetailField label="Visibility">
          {lesson.owner ? (
            <Link className="underline" href={`/users/${lesson.owner.id}`}>
              Private to {lesson.owner.name || lesson.owner.email}
            </Link>
          ) : (
            lesson.visibility
          )}
        </DetailField>
        <DetailField label="Can do">{lesson.canDo ?? "—"}</DetailField>
        <DetailField label="Chapters">
          <LessonChapters lesson={lesson} />
        </DetailField>
        <DetailField label="Skills">
          {lesson.skills.length > 0
            ? lesson.skills.map(({ skill }) => (
                <Link className="ml-2 underline" href={`/skills/${skill.id}`} key={skill.id}>
                  {skill.name}
                </Link>
              ))
            : "—"}
        </DetailField>
        <DetailField label="In plans">
          {lesson._count.planItems} plan items · {lesson._count.studyBlocks} session blocks ·{" "}
          {lesson._count.questionThreads} question threads
        </DetailField>
        <DetailField label="Votes">
          <VoteTotalsLabel totals={readVoteTotals(votes, lesson.id)} />
        </DetailField>
        <DetailField label="Updated">{formatDateTime(lesson.updatedAt)}</DetailField>
      </dl>

      <div className="mt-4 flex flex-col gap-3">
        <span className="text-muted-foreground text-xs font-medium">Outline written by</span>
        <ProvenanceFields provenance={lesson} />
        <AdminJson label="Spec" value={lesson.spec} />
        <AdminJson label="Summary card" value={lesson.summary} />
      </div>
    </AdminSection>
  );
}
