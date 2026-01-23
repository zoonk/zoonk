import { getCourseSuggestionBySlug } from "@/data/courses/course-suggestions";
import { redirect } from "@/i18n/navigation";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { notFound } from "next/navigation";

type GenerateCourseContentProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function GenerateCourseContent({ params }: GenerateCourseContentProps) {
  const { locale, slug } = await params;

  const suggestion = await getCourseSuggestionBySlug({
    language: locale,
    slug,
  });

  if (!suggestion) {
    notFound();
  }

  redirect({ href: `/generate/cs/${suggestion.id}`, locale });

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
