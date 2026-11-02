import { AuthGatePage, GatedPage } from "@/components/auth-gate";
import { Link } from "@/i18n/navigation";
import { getSession } from "@zoonk/core/users/session";
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

function WithBar({ bar, children }: { bar?: React.ReactNode; children: React.ReactNode }) {
  if (!bar) {
    return children;
  }

  return (
    <div className="flex flex-col gap-8">
      {bar}
      {children}
    </div>
  );
}

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
      <WithBar bar={bar}>
        <AuthGatePage description={description} next={next} title={title} />
      </WithBar>
    );
  }

  return (
    <WithBar bar={bar}>
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
          <EmptyContent>
            <Link className={buttonVariants()} href="/today">
              {t("Start a goal")}
            </Link>
          </EmptyContent>
        </Empty>
      </GatedPage>
    </WithBar>
  );
}
