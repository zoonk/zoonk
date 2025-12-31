import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";

type ActivityPageParams = {
  params: Promise<{
    locale: string;
    brandSlug: string;
    courseSlug: string;
    chapterSlug: string;
    lessonSlug: string;
    position: string;
  }>;
};

export async function generateMetadata({
  params,
}: ActivityPageParams): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Complete this activity to reinforce your learning and track your progress.",
    ),
    title: t("Activity"),
  };
}

export default async function ActivityPage() {
  return <main>{}</main>;
}
