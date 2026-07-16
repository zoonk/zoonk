import { getCoursePromptByCourseSlug } from "@/data/courses/course-prompt-by-course";
import { redirect } from "@/i18n/navigation";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { notFound } from "next/navigation";

export async function GenerateCourseContent({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang: locale, slug } = await params;

  const request = await getCoursePromptByCourseSlug({ language: locale, slug });

  if (!request) {
    notFound();
  }

  return redirect({ href: `/generate/course/${request.id}`, locale });
}

export function GenerateCourseFallback() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
