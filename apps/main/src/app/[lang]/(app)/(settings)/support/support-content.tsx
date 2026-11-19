import { SectionPageHeader } from "@/components/learn/section-page";
import { getAppLocale } from "@/i18n/locale";
import { getSession } from "@zoonk/core/users/session";
import { FeedbackForm, FeedbackFormSkeleton } from "@zoonk/learn/feedback/form";
import { Page, PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getSocialProfiles } from "@zoonk/ui/lib/social-profiles";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

const FOLLOW_US_ID = "follow-us";

/**
 * On a computer the message box keeps a width that reads well and ends where the bar's Send does,
 * with what the page says and where else to find us at the start.
 */
const HELP_COLUMNS_CLASS = cn(
  "lg:grid lg:grid-cols-[minmax(16rem,1fr)_minmax(0,var(--container-column))] lg:grid-rows-[auto_auto_1fr] lg:gap-x-10",
  "lg:**:data-[slot=page-subtitle]:col-start-1 lg:**:data-[slot=page-subtitle]:row-start-1",
  "lg:*:data-[slot=page-section]:col-start-1 lg:*:data-[slot=page-section]:row-start-2",
  "lg:*:data-[slot=feedback-form]:col-start-2 lg:*:data-[slot=feedback-form]:row-span-2 lg:*:data-[slot=feedback-form]:row-start-1",
  "lg:*:data-[slot=bottom-bar]:col-span-full",
);

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

      <ul className="scroll-fade-x -mx-3 -my-1 flex gap-x-2 overflow-x-auto px-1.5 py-1 sm:gap-x-3 lg:flex-wrap lg:gap-y-1">
        {socials.map((social) => (
          <li className="shrink-0" key={social.name}>
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
    <Page className={HELP_COLUMNS_CLASS}>
      <SectionPageHeader
        description={t("Ask a question, report a problem or share an idea. We answer by email.")}
        title={t("Help")}
      />

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
