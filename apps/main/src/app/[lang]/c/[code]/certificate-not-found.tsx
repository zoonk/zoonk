import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/** Non-breaking hyphens keep the example code on one line. */
const EXAMPLE_LINK = "zoonk.com/c/K7QF\u20112M9X\u2011HD4P";

/**
 * The same for a mistyped code and for a deleted account: the link no longer proves anything. It
 * stays on the page instead of `notFound()`, which would swap in the site's generic message.
 */
export async function CertificateNotFound() {
  const t = await getExtracted();

  return (
    <section className="bg-ground">
      <div className={cn(PUBLIC_CONTAINER_CLASS, "pt-10 pb-28 sm:pt-24 sm:pb-48")}>
        <div className="max-w-column">
          <h1 className="text-headline">{t("We couldn't find this certificate")}</h1>
          <p className="text-lead mt-2.5">
            {t(
              "Check the link. A certificate's link ends in its 12-character code, like {example}, and works with or without the dashes.",
              { example: EXAMPLE_LINK },
            )}
          </p>
          {/* oxlint-disable-next-line next/no-html-link-for-pages -- A full load of the home page also resets whatever broke the route. */}
          <a
            className={buttonVariants({ className: "mt-6 w-full sm:w-auto", size: "lg" })}
            href="/"
          >
            {t("Go to Zoonk")}
          </a>
        </div>
      </div>
    </section>
  );
}
