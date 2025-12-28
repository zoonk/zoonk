"use client";

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
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { FeedbackSheet } from "@/components/feedback/feedback-sheet";
import { getSocialProfiles } from "@/lib/social";

export function SupportContent() {
  const t = useExtracted();
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const socials = getSocialProfiles(locale);

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Help & Support")}</ContainerTitle>
          <ContainerDescription>
            {t(
              "Get help with your account, courses, or any technical issues. Our support team is here to assist you.",
            )}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ItemGroup>
        <Item
          render={
            <a
              href="https://github.com/zoonk/zoonk/discussions"
              rel="noopener noreferrer"
              target="_blank"
            />
          }
          size="sm"
        >
          <ItemMedia className="size-10 rounded-full bg-muted" variant="icon">
            <MessagesSquare aria-hidden="true" />
          </ItemMedia>

          <ItemContent>
            <ItemTitle>{t("GitHub Discussions")}</ItemTitle>
            <ItemDescription>
              {t("Connect with the community and get answers")}
            </ItemDescription>
          </ItemContent>
        </Item>

        <FeedbackSheet side="right">
          <Item render={<button type="button" />} size="sm">
            <ItemMedia className="size-10 rounded-full bg-muted" variant="icon">
              <Mail aria-hidden="true" />
            </ItemMedia>

            <ItemContent>
              <ItemTitle>{t("Contact Support")}</ItemTitle>
              <ItemDescription>
                {t("Email us at hello@zoonk.com")}
              </ItemDescription>
            </ItemContent>
          </Item>
        </FeedbackSheet>
      </ItemGroup>

      <ItemSeparator />

      <ContainerBody>
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {t("Follow us")}
        </h2>

        <div className="flex flex-wrap gap-2">
          {socials.map((social) => (
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
