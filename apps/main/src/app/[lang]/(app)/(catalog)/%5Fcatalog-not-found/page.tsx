import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Page not found") };
}

/**
 * Where the proxy sends a page load of a catalog link that points nowhere (a course or a category
 * that doesn't exist, `lib/catalog-not-found.ts`): it answers before anything streams, so the
 * visitor gets a real 404 and the catalog's not-found page inside the app's frame.
 */
export default function CatalogNotFoundPage(): never {
  notFound();
}
