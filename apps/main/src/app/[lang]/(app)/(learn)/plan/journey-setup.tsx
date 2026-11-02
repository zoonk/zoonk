import { Link } from "@/i18n/navigation";
import { Page, PageEyebrow, PageHeaderContent, PageSection, PageTitle } from "@zoonk/learn/page";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted } from "next-intl/server";

export async function JourneySetup({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  const t = await getExtracted();

  return (
    <Page data-slot="journey-setup">
      <PageHeaderContent>
        <PageEyebrow>{goalTitle}</PageEyebrow>
        <PageTitle>{t("Plan")}</PageTitle>
      </PageHeaderContent>

      <PageSection aria-labelledby="journey-setup-title" className="max-w-xl items-start gap-2">
        <h2 className="text-[0.9375rem] font-medium" id="journey-setup-title">
          {t("Your plan comes after a few questions")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("Answer them and we'll plan every day until you reach your goal.")}
        </p>
        <Link
          className={buttonVariants({ className: "mt-2 w-full md:w-auto", size: "lg" })}
          href={`/start/${goalId}`}
        >
          {t("Continue")}
        </Link>
      </PageSection>
    </Page>
  );
}
