import { CatalogNotFound } from "@/components/catalog/catalog-not-found";
import { NotFoundPage } from "@/components/errors/not-found-page";

export { getCatalogNotFoundMetadata as generateMetadata } from "@/components/catalog/catalog-not-found";

/** A brand has no page of its own, so its address alone is not found, inside the catalog's frame. */
export default function BrandPage() {
  return (
    <NotFoundPage>
      <CatalogNotFound />
    </NotFoundPage>
  );
}
