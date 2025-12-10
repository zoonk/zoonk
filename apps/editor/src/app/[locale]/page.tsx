"use cache";

import { setRequestLocale } from "next-intl/server";
import { EditorNavbar } from "@/components/navbar";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <EditorNavbar active="home" />
      {}
    </>
  );
}
