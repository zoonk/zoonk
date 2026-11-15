import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { PageNotFound } from "@/components/public/not-found-message";
import { EnterLink } from "@zoonk/learn/enter-button";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";

export async function getCatalogNotFoundMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Page not found") };
}

export async function CatalogNotFound() {
  const t = await getExtracted();

  return (
    <>
      <CatalogPageBar back={{ href: "/courses", label: t("Explore courses") }} />
      <PageNotFound action={<EnterLink href="/courses">{t("Explore courses")}</EnterLink>} />
    </>
  );
}
