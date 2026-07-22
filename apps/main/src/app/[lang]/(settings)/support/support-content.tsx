import { ContactForm, ContactFormSkeleton } from "@/components/feedback/contact-form";
import { getSession } from "@/data/users/get-session";
import { getSocialProfiles } from "@/lib/social";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { ItemSeparator } from "@zoonk/ui/components/item";
import { getExtracted, getLocale } from "next-intl/server";
import { Suspense } from "react";

/**
 * Adds the signed-in learner's email without holding back the rest of the support page.
 */
async function ContactSupport() {
  const session = await getSession();

  return <ContactForm defaultEmail={session?.user.email} />;
}

export async function SupportContent() {
  const t = await getExtracted();
  const locale = await getLocale();
  const socials = getSocialProfiles(locale);

  return (
    <Container>
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Feedback & Support")}</ContainerTitle>
          <ContainerDescription>
            {t("Share feedback, ask questions, or get help with your account and courses.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="lg:max-w-md">
        <Suspense fallback={<ContactFormSkeleton />}>
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
    </Container>
  );
}
