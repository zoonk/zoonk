import curriculum from "@/app/(private)/_mock/data/course-curriculum.json";
import { MockConfirmButton } from "@/app/(private)/_mock/menu";
import { AdminDetailBody, AdminDetailHeader, AdminDetailPage } from "@/components/admin-detail";
import { AdminSection } from "@/components/admin-section";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";

export default function CourseMockPage() {
  const chapters = curriculum.flatMap((band) => band.chapters);
  const lessons = chapters.flatMap((chapter) => chapter.lessons);
  const written = lessons.filter((lesson) => lesson.state === "Written").length;

  return (
    <AdminDetailPage>
      <AdminDetailHeader
        actions={
          <MockConfirmButton
            confirmLabel="Save changes"
            description="What learners see as the course's name, and its address."
            label="Edit"
            title="Edit this course"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input defaultValue="How the stock market works" id="title" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input defaultValue="how-the-stock-market-works" id="slug" />
              <p className="text-muted-foreground text-xs">
                Changing it breaks existing links to this course.
              </p>
            </div>
          </MockConfirmButton>
        }
        facts={["English", "Published", "0 learners"]}
        parents={[{ href: "/courses", label: "Courses" }]}
        title="How the stock market works"
      />

      <AdminDetailBody>
        {curriculum.map((band) => (
          <AdminSection
            description={`${written} of ${lessons.length} lessons written in ${chapters.length} chapters`}
            key={band.band}
            title={`Curriculum: ${band.band}`}
          >
            <ol className="divide-y">
              {band.chapters.map((chapter, index) => (
                <li
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 py-4"
                  key={chapter.title}
                >
                  <span className="text-muted-foreground font-mono text-xs leading-6 tabular-nums">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="font-medium">{chapter.title}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {chapter.lessons.filter((lesson) => lesson.state === "Written").length} of{" "}
                        {chapter.lessons.length} written
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {chapter.lessons.map((lesson) => (
                        <li
                          className="flex items-baseline justify-between gap-4 text-sm"
                          key={lesson.title}
                        >
                          <span className="flex items-baseline gap-2">
                            <a href="#">{lesson.title}</a>
                            {lesson.shared ? (
                              <span className="text-muted-foreground text-xs">Shared lesson</span>
                            ) : null}
                          </span>
                          <span
                            className={
                              lesson.state === "Written"
                                ? "text-foreground shrink-0 text-xs"
                                : "text-faint shrink-0 text-xs"
                            }
                          >
                            {lesson.state}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </AdminSection>
        ))}
      </AdminDetailBody>
    </AdminDetailPage>
  );
}
