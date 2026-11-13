import { AuthGatePage, GatedPage } from "@/components/auth-gate";
import { getSession } from "@zoonk/core/users/session";
import { EnterLink } from "@zoonk/learn/enter-button";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { TargetIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/** Someone without a session may have a goal in their account, so they're asked to log in first. */
export async function LearnNoGoal({
  bar,
  description,
  next,
  title,
}: {
  bar?: React.ReactNode;
  description: string;
  next: string;
  title: string;
}) {
  const t = await getExtracted();
  const session = await getSession();

  if (!session) {
    return (
      <>
        {bar}
        <AuthGatePage description={description} next={next} title={title} />
      </>
    );
  }

  return (
    <>
      {bar}
      <GatedPage description={description} title={title}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TargetIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              <h2>{t("Start with a goal")}</h2>
            </EmptyTitle>
            <EmptyDescription>
              {t("Tell us what you want to learn, and we'll plan every day until you get there.")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>

        <BottomBar>
          <BottomBarActions>
            <EnterLink href="/today">{t("Start a goal")}</EnterLink>
          </BottomBarActions>
        </BottomBar>
      </GatedPage>
    </>
  );
}
