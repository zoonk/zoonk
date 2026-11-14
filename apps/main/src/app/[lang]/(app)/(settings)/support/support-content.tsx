import { SectionPageHeader } from "@/components/learn/section-page";
import { getAppLocale } from "@/i18n/locale";
import { getSession } from "@zoonk/core/users/session";
import { FeedbackForm, FeedbackFormSkeleton } from "@zoonk/learn/feedback/form";
import { Page, PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getSocialProfiles } from "@zoonk/ui/lib/social-profiles";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

const FOLLOW_US_ID = "follow-us";

async function ContactSupport({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  const email = session && !session.user.isAnonymous ? session.user.email : null;

  return (
    <FeedbackForm context={{ screen: "support" }} defaultEmail={email}>
      {children}
    </FeedbackForm>
  );
}

async function FollowUs() {
  const t = await getExtracted();
  const locale = await getAppLocale();
  const socials = getSocialProfiles(locale);

  return (
    <PageSection aria-labelledby={FOLLOW_US_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={FOLLOW_US_ID}>{t("Follow us")}</PageSectionTitle>
      </PageSectionHeader>

      <ul className="-ml-1.5 grid grid-cols-5 gap-y-2 sm:flex sm:gap-x-3">
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
    <Page measure="form">
      <SectionPageHeader title={t("Help")} />

      <p className="text-muted-foreground -mt-4 text-sm text-pretty md:mt-0">
        {t("Ask a question, report a problem or share an idea. We answer by email.")}
      </p>

      <Suspense
        fallback={
          <FeedbackFormSkeleton>
            <FollowUs />
          </FeedbackFormSkeleton>
        }
      >
        <ContactSupport>
          <FollowUs />
        </ContactSupport>
      </Suspense>
    </Page>
  );
}
