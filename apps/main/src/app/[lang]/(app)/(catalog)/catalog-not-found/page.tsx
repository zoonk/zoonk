import { CatalogNotFound } from "@/components/catalog/catalog-not-found";
import { NotFoundPage } from "@/components/errors/not-found-page";

export { getCatalogNotFoundMetadata as generateMetadata } from "@/components/catalog/catalog-not-found";

/** No `%5F` in its folder name: Next.js 16.4 then misses the route's fonts and paints the fallback font first. */
export default function CatalogNotFoundPage() {
  return (
    <NotFoundPage>
      <CatalogNotFound />
    </NotFoundPage>
  );
}
