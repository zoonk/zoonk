import { Wizard } from "@zoonk/ui/components/wizard";
import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { WizardView } from "./wizard-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { title: t("Create course") };
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
