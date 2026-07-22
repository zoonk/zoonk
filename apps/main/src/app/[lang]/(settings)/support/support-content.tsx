import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
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
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Mail, MessagesSquare } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import { Suspense } from "react";

type ContactSupportItemProps = { description: string; disabled?: boolean; title: string };

/**
 * Keeps the support row identical while session data resolves so the cold-path
 * fallback does not shift the surrounding static support content.
 */
function ContactSupportItem({ description, disabled, title }: ContactSupportItemProps) {
  return (
    <Item
      render={<button aria-busy={disabled || undefined} disabled={disabled} type="button" />}
      size="sm"
    >
      <ItemMedia className="bg-muted size-10 rounded-full" variant="icon">
        <Mail aria-hidden="true" />
      </ItemMedia>

      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

/**
 * Adds the signed-in learner's email only after the private session cache has
 * resolved, leaving the rest of the support page available immediately.
 */
async function ContactSupport(props: ContactSupportItemProps) {
  const session = await getSession();

  return (
    <FeedbackDialog defaultEmail={session?.user.email}>
      <ContactSupportItem {...props} />
    </FeedbackDialog>
  );
}

export async function SupportContent() {
  const t = await getExtracted();
  const locale = await getLocale();
  const socials = getSocialProfiles(locale);

  const contactSupportProps = {
    description: t("Email us at hello@zoonk.com"),
    title: t("Contact Support"),
  };

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

      <ItemGroup>
        <Item
          render={
            // oxlint-disable-next-line jsx-a11y/anchor-has-content -- render prop
            <a
              href="https://github.com/zoonk/zoonk/discussions"
              rel="noopener noreferrer"
              target="_blank"
            />
          }
          size="sm"
        >
          <ItemMedia className="bg-muted size-10 rounded-full" variant="icon">
            <MessagesSquare aria-hidden="true" />
          </ItemMedia>

          <ItemContent>
            <ItemTitle>{t("GitHub Discussions")}</ItemTitle>
            <ItemDescription>{t("Connect with the community and get answers")}</ItemDescription>
          </ItemContent>
        </Item>

        <Suspense fallback={<ContactSupportItem {...contactSupportProps} disabled />}>
          <ContactSupport {...contactSupportProps} />
        </Suspense>
      </ItemGroup>

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
