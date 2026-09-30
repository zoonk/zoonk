import { getSocialProfiles } from "@/lib/social";
import { getSession } from "@zoonk/core/users/session";
import { FeedbackForm, FeedbackFormSkeleton } from "@zoonk/learn/feedback/form";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
} from "@zoonk/ui/components/container";
import { ItemSeparator } from "@zoonk/ui/components/item";
import { getExtracted, getLocale } from "next-intl/server";
import { Suspense } from "react";
import { SettingsPage, SettingsPageTitle } from "../_components/settings-page";

/**
 * Adds the signed-in learner's email without holding back the rest of the support page.
 */
async function ContactSupport() {
  const session = await getSession();

  const email = session && !session.user.isAnonymous ? session.user.email : null;

  return <FeedbackForm context={{ screen: "support" }} defaultEmail={email} />;
}

export async function SupportContent() {
  const t = await getExtracted();
  const locale = await getLocale();
  const socials = getSocialProfiles(locale);

  return (
    <SettingsPage>
      <ContainerHeader>
        <ContainerHeaderGroup>
          <SettingsPageTitle>{t("Feedback & Support")}</SettingsPageTitle>
          <ContainerDescription>
            {t("Share feedback, ask questions, or get help with your account and courses.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="lg:max-w-md">
        <Suspense fallback={<FeedbackFormSkeleton />}>
          <ContactSupport />
        </Suspense>
      </ContainerBody>

      <ItemSeparator />

      <ContainerBody>
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {t("Follow us")}
        </h2>

        <div className="flex flex-wrap gap-2">
          {socials.map((social) => (
            // oxlint-disable-next-line next/no-html-link-for-pages -- external links
            <a
              className={buttonVariants({ size: "icon", variant: "outline" })}
              href={social.url}
              key={social.name}
              rel="noopener noreferrer"
              target="_blank"
            >
              <social.icon aria-hidden="true" className="size-4" />
              <span className="sr-only">{social.name}</span>
            </a>
          ))}
        </div>
      </ContainerBody>
    </SettingsPage>
  );
}
