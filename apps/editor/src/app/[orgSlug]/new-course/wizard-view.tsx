import { CreateCourseWizard } from "./create-course-wizard";

export async function WizardView({
  params,
}: {
  params: PageProps<"/[orgSlug]/new-course">["params"];
}) {
  const { orgSlug } = await params;

  return <CreateCourseWizard orgSlug={orgSlug} />;
}
