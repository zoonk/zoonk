import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/my">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "View all the courses you started on Zoonk. Continue where you left off and track your progress across interactive lessons and activities.",
    ),
    title: t("My Courses"),
  };
}

export default async function MyCourses() {
  return <main>{}</main>;
}
