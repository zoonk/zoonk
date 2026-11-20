import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { PageNotFound } from "@/components/public/not-found-message";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { CatalogNotFoundAction } from "./catalog-not-found-action";

export async function getCatalogNotFoundMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Page not found") };
}

export async function CatalogNotFound() {
  const t = await getExtracted();
  const courses = t("Explore courses");

  return (
    <>
      <CatalogPageBar back={{ href: "/courses", label: courses }} />
      <PageNotFound action={<CatalogNotFoundAction courses={courses} today={t("Today")} />} />
    </>
  );
}
