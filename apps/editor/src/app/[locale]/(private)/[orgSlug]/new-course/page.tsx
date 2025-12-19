import { Wizard } from "@zoonk/ui/components/wizard";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CreateCourseWizard } from "./create-course-wizard";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[orgSlug]/new-course">): Promise<Metadata> {
  "use cache";

  const { locale } = await params;
  const t = await getExtracted({ locale });

  cacheLife("max");
  cacheTag(locale);

  return { title: t("Create course") };
}

async function WizardView({
  params,
}: {
  params: PageProps<"/[locale]/[orgSlug]/new-course">["params"];
}) {
  "use cache";

  const { locale, orgSlug } = await params;

  cacheLife("max");
  cacheTag(locale);

  setRequestLocale(locale);

  return <CreateCourseWizard orgSlug={orgSlug} />;
}

export default async function NewCoursePage({
  params,
}: PageProps<"/[locale]/[orgSlug]/new-course">) {
  return (
    <Wizard>
      <Suspense fallback={null}>
        <WizardView params={params} />
      </Suspense>
    </Wizard>
  );
}
