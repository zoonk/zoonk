import { CatalogNotFound } from "@/components/catalog/catalog-not-found";
import { NotFoundPage } from "@/components/errors/not-found-page";

export { getCatalogNotFoundMetadata as generateMetadata } from "@/components/catalog/catalog-not-found";

/**
 * Where the proxy sends a page load of a catalog link that points nowhere (a course or a category
 * that doesn't exist, `lib/catalog-not-found.ts`): a real 404 with the catalog's not-found message
 * inside the app's frame, in the page's HTML. Its folder has no `%5F` (an underscore address):
 * Next.js 16.4 then misses the route's fonts and the page paints in the fallback font first.
 */
export default function CatalogNotFoundPage() {
  return (
    <NotFoundPage>
      <CatalogNotFound />
    </NotFoundPage>
  );
}
