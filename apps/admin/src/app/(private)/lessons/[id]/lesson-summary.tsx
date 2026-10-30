import { AdminJson } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type LibraryLessonDetail } from "@/data/lessons/get-library-lesson";
import { formatDateTime } from "@/lib/format";
import { libraryLessonStatusLabels } from "@/lib/library-lesson-filters";
import Link from "next/link";
import { LessonHeldBack } from "./lesson-held-back";

type Lesson = LibraryLessonDetail["lesson"];

function LessonChapters({ lesson }: { lesson: Lesson }) {
  if (lesson.chapters.length === 0) {
    return <span className="text-muted-foreground">Not in any chapter</span>;
  }

  return (
    <ul className="flex flex-col gap-1">
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

export function LessonSummary({ lesson }: { lesson: Lesson }) {
  return (
    <AdminSection title="Details">
      <DetailFields>
        <DetailField label="Description">{lesson.description || "—"}</DetailField>
        <DetailField label="Held back">
          <LessonHeldBack lesson={lesson} />
        </DetailField>
        <DetailField label="Spec">{libraryLessonStatusLabels[lesson.specStatus]}</DetailField>
        <DetailField label="Visibility">
          {lesson.owner ? (
            <Link className="underline" href={`/users/${lesson.owner.id}`}>
              Private to {lesson.owner.name || lesson.owner.email}
            </Link>
          ) : (
            <span className="capitalize">{lesson.visibility}</span>
          )}
        </DetailField>
        <DetailField label="Can do">{lesson.canDo ?? "—"}</DetailField>
        <DetailField label="Chapters">
          <LessonChapters lesson={lesson} />
        </DetailField>
        <DetailField label="Skills">
          {lesson.skills.length > 0 ? (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {lesson.skills.map(({ skill }) => (
                <Link className="underline" href={`/skills/${skill.id}`} key={skill.id}>
                  {skill.name}
                </Link>
              ))}
            </span>
          ) : (
            "—"
          )}
        </DetailField>
        <DetailField label="In plans">
          {lesson._count.planItems} plan items · {lesson._count.studyBlocks} session blocks ·{" "}
          {lesson._count.questionThreads} question threads
        </DetailField>
        <DetailField label="Updated">{formatDateTime(lesson.updatedAt)}</DetailField>
      </DetailFields>
    </AdminSection>
  );
}

export function LessonOutline({ lesson }: { lesson: Lesson }) {
  return (
    <AdminSection title="Outline">
      <ProvenanceFields provenance={lesson} />
      <div className="flex flex-col">
        <AdminJson label="Spec" value={lesson.spec} />
        <AdminJson label="Summary card" value={lesson.summary} />
      </div>
    </AdminSection>
  );
}
