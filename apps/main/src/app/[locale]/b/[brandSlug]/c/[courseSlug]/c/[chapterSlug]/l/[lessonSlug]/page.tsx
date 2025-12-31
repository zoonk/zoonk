import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";

type LessonPageParams = {
  params: Promise<{
    locale: string;
    brandSlug: string;
    courseSlug: string;
    chapterSlug: string;
    lessonSlug: string;
  }>;
};

export async function generateMetadata({
  params,
}: LessonPageParams): Promise<Metadata> {
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
