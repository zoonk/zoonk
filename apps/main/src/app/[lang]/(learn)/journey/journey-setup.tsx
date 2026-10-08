import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { RouteIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/**
 * A goal still in onboarding has no plan to show yet: its few questions are the one way there,
 * picked up where the learner left them.
 */
export async function JourneySetup({ goalId }: { goalId: string }) {
  const t = await getExtracted();

  return (
    <Empty className="py-16" data-slot="journey-setup">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RouteIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <h1>{t("Your plan comes after a few questions")}</h1>
        </EmptyTitle>
        <EmptyDescription>
          {t("Answer them and we'll plan every day until you reach your goal.")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link className={buttonVariants()} href={`/start/${goalId}`}>
          {t("Continue")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
