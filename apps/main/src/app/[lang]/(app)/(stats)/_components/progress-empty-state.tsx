import { AuthGate } from "@/components/auth-gate";
import { getMenu } from "@/lib/menu";
import { EnterLink } from "@zoonk/learn/enter-button";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { getExtracted } from "next-intl/server";

export async function ProgressEmptyState({
  isAuthenticated,
  next,
}: {
  isAuthenticated: boolean;
  next: string;
}) {
  const t = await getExtracted();
  const { icon: Icon } = getMenu("stats");

  if (!isAuthenticated) {
    return <AuthGate bar next={next} />;
  }

  return (
    <>
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("No statistics yet")}</EmptyTitle>
          <EmptyDescription>{t("They show up after your first lesson.")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
      <BottomBar>
        <BottomBarActions>
          <EnterLink href={getMenu("today").url}>{t("Go to Today")}</EnterLink>
        </BottomBarActions>
      </BottomBar>
    </>
  );
}
