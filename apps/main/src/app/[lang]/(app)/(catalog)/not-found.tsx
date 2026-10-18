import { CatalogNotFound } from "@/components/catalog/catalog-not-found";

/** A catalog page that isn't there, shown by the browser where a page threw `notFound()`. */
export default function NotFound() {
  return <CatalogNotFound />;
}
