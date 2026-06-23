import { getCourseStartRequestByCourseSlug } from "@/data/courses/course-start-request-by-course";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

export async function GenerateCourseContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();

  const request = await getCourseStartRequestByCourseSlug({ language: locale, slug });

  if (!request) {
    notFound();
  }

  redirect(`/generate/course/${request.id}`);

  return null;
}

export function GenerateCourseFallback() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
