import { Wizard } from "@zoonk/ui/components/wizard";
import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CreateCourseWizard } from "./create-course-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { title: t("Create course") };
}

async function WizardView({
  params,
}: {
  params: PageProps<"/[orgSlug]/new-course">["params"];
}) {
  const { orgSlug } = await params;

  return <CreateCourseWizard orgSlug={orgSlug} />;
}

export default async function NewCoursePage({
  params,
}: PageProps<"/[orgSlug]/new-course">) {
  return (
    <Wizard>
      <Suspense fallback={null}>
        <WizardView params={params} />
      </Suspense>
    </Wizard>
  );
}
