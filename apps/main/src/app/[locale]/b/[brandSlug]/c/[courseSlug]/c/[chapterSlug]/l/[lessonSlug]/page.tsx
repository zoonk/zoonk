import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]/c/[chapterSlug]/l/[lessonSlug]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Interactive lesson with exercises and activities to help you learn effectively.",
    ),
    title: t("Lesson"),
  };
}

export default async function LessonPage() {
  return <main>{}</main>;
}
