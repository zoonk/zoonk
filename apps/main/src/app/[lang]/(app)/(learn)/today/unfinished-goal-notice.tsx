import { DRAFT_PARAM } from "@/app/[lang]/(app)/(onboarding)/start/start-params";
import { Link } from "@/i18n/navigation";
import {
  NoticeCard,
  NoticeCardActions,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardTitle,
} from "@zoonk/learn/notice";
import { buttonVariants } from "@zoonk/ui/components/button";
import { PenLineIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export type UnfinishedGoal = { draftId: string; prompt: string };

export async function UnfinishedGoalNotice({ goal }: { goal: UnfinishedGoal }) {
  const t = await getExtracted();

  return (
    <section aria-label={t("A goal you started")}>
      <NoticeCard>
        <PenLineIcon aria-hidden="true" />

        <NoticeCardContent>
          <NoticeCardTitle className="line-clamp-2">{goal.prompt}</NoticeCardTitle>
          <NoticeCardDescription>{t("You didn't finish setting this up.")}</NoticeCardDescription>

          <NoticeCardActions>
            <Link
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href={`/start?${DRAFT_PARAM}=${goal.draftId}`}
              prefetch
            >
              {t("Continue")}
            </Link>
          </NoticeCardActions>
        </NoticeCardContent>
      </NoticeCard>
    </section>
  );
}
