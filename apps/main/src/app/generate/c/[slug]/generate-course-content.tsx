import { getCourseSuggestionBySlug } from "@/data/courses/course-suggestions";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { notFound, redirect } from "next/navigation";

export async function GenerateCourseContent({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

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
