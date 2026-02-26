import { getCourseSuggestionBySlug } from "@/data/courses/course-suggestions";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

export async function GenerateCourseContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();

  const suggestion = await getCourseSuggestionBySlug({
    language: locale,
    slug,
  });

  if (!suggestion) {
    notFound();
  }

  redirect(`/generate/cs/${suggestion.id}`);

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
