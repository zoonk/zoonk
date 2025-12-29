import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";

type CoursePageParams = {
  params: Promise<{
    locale: string;
    brandSlug: string;
    courseSlug: string;
  }>;
};

export async function generateMetadata({
  params,
}: CoursePageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Learn with interactive lessons and activities. Explore this course and start your learning journey.",
    ),
    title: t("Course"),
  };
}

export default async function CoursePage() {
  return <main>{}</main>;
}
