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
import { TargetIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/** Tabs without a goal have one next step: starting one. */
export async function LearnNoGoal() {
  const t = await getExtracted();

  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TargetIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <h1>{t("Start with a goal")}</h1>
        </EmptyTitle>
        <EmptyDescription>
          {t("Tell us what you want to learn, and we'll plan every day until you get there.")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link className={buttonVariants()} href="/start">
          {t("Start a goal")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
