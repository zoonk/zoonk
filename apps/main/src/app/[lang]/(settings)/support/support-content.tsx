import { getSocialProfiles } from "@/lib/social";
import { getSession } from "@zoonk/core/users/session";
import { FeedbackForm, FeedbackFormSkeleton } from "@zoonk/learn/feedback/form";
import { Page, PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted, getLocale } from "next-intl/server";
import { Suspense } from "react";

const FOLLOW_US_ID = "follow-us";

/**
 * Adds the signed-in learner's email without holding back the rest of the support page.
 */
async function ContactSupport() {
  const session = await getSession();

  const email = session && !session.user.isAnonymous ? session.user.email : null;

  return <FeedbackForm context={{ screen: "support" }} defaultEmail={email} />;
}

/** Where else to find Zoonk: the Brazilian profiles in Portuguese, the global ones otherwise. */
async function FollowUs() {
  const [t, locale] = await Promise.all([getExtracted(), getLocale()]);
  const socials = getSocialProfiles(locale);

  return (
    <section aria-labelledby={FOLLOW_US_ID} className="flex flex-col gap-3 border-t pt-6">
      <h2 className="text-base font-semibold" id={FOLLOW_US_ID}>
        {t("Follow us")}
      </h2>

      {/* Two even rows of five on phones, one row from `sm`. */}
      <ul className="grid w-max grid-cols-5 gap-2 sm:flex">
        {socials.map((social) => (
          <li key={social.name}>
            {/* oxlint-disable-next-line next/no-html-link-for-pages -- external links */}
            <a
              className={buttonVariants({ size: "icon", variant: "outline" })}
              href={social.url}
              rel="noopener noreferrer"
              target="_blank"
              title={social.label}
            >
              <social.icon aria-hidden="true" className="size-4" />
              <span className="sr-only">{social.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Help: a message to the team (a question, a problem or an idea), then where else to find us. */
export async function SupportContent() {
  const t = await getExtracted();

  return (
    <Page>
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>{t("Help")}</PageTitle>
          <PageSubtitle>
            {t("Ask a question, report a problem or share an idea. We answer by email.")}
          </PageSubtitle>
        </PageHeaderContent>
      </PageHeader>

      <Suspense fallback={<FeedbackFormSkeleton />}>
        <ContactSupport />
      </Suspense>

      <FollowUs />
    </Page>
  );
}
