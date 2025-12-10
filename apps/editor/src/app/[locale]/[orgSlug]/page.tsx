import { setRequestLocale } from "next-intl/server";
import { EditorNavbar } from "@/components/navbar";

export default async function OrgHomePage({
  params,
}: PageProps<"/[locale]/[orgSlug]">) {
  "use cache";

  const { locale } = await params;

  setRequestLocale(locale);

  return (
    <>
      <EditorNavbar active="courses" />
      {}
    </>
  );
}
