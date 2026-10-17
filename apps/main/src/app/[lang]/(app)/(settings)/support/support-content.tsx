import { SectionPageHeader } from "@/components/learn/section-page";
import { LearnerWitness } from "@/components/learner/learner-witness";
import { getSocialProfiles } from "@/lib/social";
import { getSession } from "@zoonk/core/users/session";
import { FeedbackForm, FeedbackFormSkeleton } from "@zoonk/learn/feedback/form";
import { Page, PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted, getLocale } from "next-intl/server";
import { Suspense } from "react";

const FOLLOW_US_ID = "follow-us";

const MAIN_NETWORKS = new Set(["x", "instagram", "linkedin", "youtube", "bluesky"]);

/**
 * Adds the signed-in learner's email without holding back the rest of the support page.
 */
async function ContactSupport() {
  const session = await getSession();

  const email = session && !session.user.isAnonymous ? session.user.email : null;

  return (
    <>
      <LearnerWitness />
      <FeedbackForm context={{ screen: "support" }} defaultEmail={email} />
    </>
  );
}

/** Where else to find Zoonk: the Brazilian profiles in Portuguese, the global ones otherwise. */
async function FollowUs() {
  const t = await getExtracted();
  const locale = await getLocale();
  const socials = getSocialProfiles(locale).filter((social) => MAIN_NETWORKS.has(social.name));

  return (
    <PageSection aria-labelledby={FOLLOW_US_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={FOLLOW_US_ID}>{t("Follow us")}</PageSectionTitle>
      </PageSectionHeader>

      {/* One quiet line of bare glyphs, each a 44px target: the form above is what the page is for. */}
      <ul className="-ml-1.5 flex flex-wrap gap-x-3 gap-y-2">
        {socials.map((social) => (
          <li key={social.name}>
            {/* oxlint-disable-next-line next/no-html-link-for-pages -- external links */}
            <a
              className={buttonVariants({
                className: "text-muted-foreground hover:text-foreground",
                size: "icon-sm",
                variant: "ghost",
              })}
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
    </PageSection>
  );
}

/** Help: a message to the team (a question, a problem or an idea), then where else to find us. */
export async function SupportContent() {
  const t = await getExtracted();

  return (
    <Page>
      <SectionPageHeader title={t("Help")} />

      {/* What the form is for, at every size: it's the page's one task. */}
      <p className="text-muted-foreground -mt-4 text-sm text-pretty md:mt-0">
        {t("Ask a question, report a problem or share an idea. We answer by email.")}
      </p>

      <Suspense fallback={<FeedbackFormSkeleton />}>
        <ContactSupport />
      </Suspense>

      <FollowUs />
    </Page>
  );
}
