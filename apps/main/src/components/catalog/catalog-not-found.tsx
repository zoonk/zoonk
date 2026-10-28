import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { NotFoundMessage } from "@/components/public/not-found-message";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ArrowRightIcon } from "lucide-react";
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

      <NotFoundMessage>
        <Link className={buttonVariants({ size: "lg" })} href="/courses" prefetch>
          {t("Explore courses")}
          <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
        </Link>
      </NotFoundMessage>
    </>
  );
}
