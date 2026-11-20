import { getAppLocale } from "@/i18n/locale";
import { getMenu } from "@/lib/menu";
import { PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getSocialProfiles } from "@zoonk/ui/lib/social-profiles";
import { cn } from "@zoonk/ui/lib/utils";
import { BLOG_URL } from "@zoonk/utils/url";
import { getExtracted } from "next-intl/server";

const FOLLOW_US_ID = "follow-us";

export async function FollowUs() {
  const t = await getExtracted();
  const locale = await getAppLocale();

  const socials = [
    { icon: getMenu("blog").icon, label: t("Blog"), name: "blog", url: BLOG_URL },
    ...getSocialProfiles(locale),
  ];

  return (
    <PageSection aria-labelledby={FOLLOW_US_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={FOLLOW_US_ID}>{t("Follow us")}</PageSectionTitle>
      </PageSectionHeader>

      {/* Rows that wrap share the icons evenly, so none is left alone on a row of its own. */}
      <div className="@container">
        <ul className="-mx-1.5 -my-1 grid w-fit grid-cols-5 gap-x-2 gap-y-1 py-1 @md:grid-cols-10 @md:gap-x-3">
          {socials.map((social) => (
            <li className="shrink-0" key={social.name}>
              {/* oxlint-disable-next-line next/no-html-link-for-pages -- external links */}
              <a
                className={cn(
                  buttonVariants({ size: "icon-sm", variant: "ghost" }),
                  "text-muted-foreground hover:text-foreground",
                )}
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
      </div>
    </PageSection>
  );
}
