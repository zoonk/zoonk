import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CreateCourseWizard } from "./create-course-wizard";

type Params = {
  locale: string;
  orgSlug: string;
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Create Course" };
}

export default async function NewCoursePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, orgSlug } = await params;
  setRequestLocale(locale);

  return (
    <Suspense>
      <CreateCourseWizard orgSlug={orgSlug} />
    </Suspense>
  );
}
