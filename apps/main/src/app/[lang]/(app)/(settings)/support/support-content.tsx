import { SectionPageHeader } from "@/components/learn/section-page";
import { getSocialProfiles } from "@/lib/social";
import { getSession } from "@zoonk/core/users/session";
import { FeedbackForm, FeedbackFormSkeleton } from "@zoonk/learn/feedback/form";
import { Page, PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted, getLocale } from "next-intl/server";
import { Suspense } from "react";

const FOLLOW_US_ID = "follow-us";

const MAIN_NETWORKS = new Set(["x", "instagram", "linkedin", "youtube", "bluesky"]);

async function ContactSupport() {
  const session = await getSession();

  const email = session && !session.user.isAnonymous ? session.user.email : null;

  return <FeedbackForm context={{ screen: "support" }} defaultEmail={email} />;
}

async function FollowUs() {
  const t = await getExtracted();
  const locale = await getLocale();
  const socials = getSocialProfiles(locale).filter((social) => MAIN_NETWORKS.has(social.name));

  return (
    <PageSection aria-labelledby={FOLLOW_US_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={FOLLOW_US_ID}>{t("Follow us")}</PageSectionTitle>
      </PageSectionHeader>

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

export async function SupportContent() {
  const t = await getExtracted();

  return (
    <Page>
      <SectionPageHeader title={t("Help")} />

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
