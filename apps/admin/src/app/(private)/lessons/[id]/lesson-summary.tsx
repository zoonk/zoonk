import { AdminJson } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { ProvenanceFields } from "@/components/provenance";
import { type LibraryLessonDetail } from "@/data/lessons/get-library-lesson";
import { formatCount, formatDateTime } from "@/lib/format";
import { LINK_CLASS } from "@/lib/link-class";
import Link from "next/link";
import { LessonHeldBack } from "./lesson-held-back";

type Lesson = LibraryLessonDetail["lesson"];

function LessonChapters({ lesson }: { lesson: Lesson }) {
  if (lesson.chapters.length === 0) {
    return "Not in any chapter";
  }

  return (
    <span className="flex flex-col gap-2">
      {lesson.chapters.map(({ chapter }) => (
        <span className="flex flex-col" key={chapter.id}>
          {chapter.title}
          {chapter.courses.map(({ course }) => (
            <Link
              className={`${LINK_CLASS} text-muted-foreground text-xs`}
              href={`/courses/${course.id}`}
              key={course.id}
            >
              {course.title}
            </Link>
          ))}
        </span>
      ))}
    </span>
  );
}

/** Beside the screens: what the lesson teaches, where it sits and who is using it. */
export function LessonAbout({ lesson }: { lesson: Lesson }) {
  return (
    <>
      <AdminSection title="About">
        <DetailFields>
          <DetailField label="Teaches">
            {lesson.skills.length > 0 ? (
              <span className="flex flex-col gap-1">
                {lesson.skills.map(({ skill }) => (
                  <Link className={LINK_CLASS} href={`/skills/${skill.id}`} key={skill.id}>
                    {skill.name}
                  </Link>
                ))}
              </span>
            ) : (
              "No skill yet"
            )}
          </DetailField>
          <DetailField label="Chapter">
            <LessonChapters lesson={lesson} />
          </DetailField>
          <DetailField label="Open to">
            {lesson.owner ? (
              <Link className={LINK_CLASS} href={`/users/${lesson.owner.id}`}>
                Only {lesson.owner.name || lesson.owner.email}
              </Link>
            ) : (
              "Everyone"
            )}
          </DetailField>
        </DetailFields>
      </AdminSection>

      <AdminSection title="Learners">
        <DetailFields>
          <DetailField label="In plans">
            {formatCount(lesson._count.planItems, "plan")} ·{" "}
            {formatCount(lesson._count.studyBlocks, "session")}
          </DetailField>
          <DetailField label="Buddy questions">
            {lesson._count.questionThreads.toLocaleString("en")}
          </DetailField>
        </DetailFields>
      </AdminSection>
    </>
  );
}

export function LessonDetails({ lesson }: { lesson: Lesson }) {
  return (
    <AdminSection title="Details">
      <DetailFields>
        <DetailField label="Description">{lesson.description}</DetailField>
        <DetailField label="Learners can then">{lesson.canDo}</DetailField>
        <DetailField label="Held back">
          <LessonHeldBack lesson={lesson} />
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
