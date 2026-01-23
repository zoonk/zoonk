import { getExtracted } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]/c/[chapterSlug]/l/[lessonSlug]/a/[position]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t("Complete this activity to reinforce your learning and track your progress."),
    title: t("Activity"),
  };
}

export default async function ActivityPage() {
  return <main>{}</main>;
}
