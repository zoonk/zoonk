import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { CreateCourseWizard } from "./create-course-wizard";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[orgSlug]/new-course">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return { title: t("Create course") };
}

export default async function NewCoursePage({
  params,
}: PageProps<"/[locale]/[orgSlug]/new-course">) {
  const { orgSlug } = await params;

  return <CreateCourseWizard orgSlug={orgSlug} />;
}
