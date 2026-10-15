import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { NotFoundMessage } from "@/components/public/not-found-message";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ArrowRightIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";

/** A missing catalog page's title, kept out of search results. */
export async function getCatalogNotFoundMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Page not found") };
}

/**
 * A catalog page that isn't there (a course or a category from an old or mistyped link) says so
 * inside the app's frame, as the app's other pages do: the sidebar and the bar back to Explore
 * courses stay, and its one way on is the catalog, where the course may be under another name.
 */
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
