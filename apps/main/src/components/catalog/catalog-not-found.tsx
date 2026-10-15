import { CatalogPageBar } from "@/components/catalog/catalog-page-bar";
import { NotFoundMessage } from "@/components/public/not-found-message";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ArrowRightIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

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
export async function CatalogNotFoundMessage() {
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

/** Answers the page with a 404, from inside a boundary so the message around it stays. */
function NotFoundStatus(): never {
  notFound();
}

/**
 * A catalog page's answer when it has nothing to show: the not-found message in the page's HTML,
 * there from the first paint, with a 404. A `notFound()` outside a boundary would give the 404
 * with an empty page that only the browser fills in, so the page draws the message itself and
 * throws inside an empty boundary: the static render keeps everything outside it and answers 404,
 * and in the browser the catalog's not-found boundary shows the same message in its place.
 */
export function CatalogNotFoundPage() {
  return (
    <>
      <CatalogNotFoundMessage />

      <Suspense fallback={null}>
        <NotFoundStatus />
      </Suspense>
    </>
  );
}
