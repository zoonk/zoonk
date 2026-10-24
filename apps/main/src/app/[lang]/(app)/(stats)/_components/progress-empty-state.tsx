import { AuthGate } from "@/components/auth-gate";
import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { getExtracted } from "next-intl/server";
import { ProgressContent } from "./progress-content";

/**
 * Visitors get the gate every page that needs an account shows (log in and come back to this
 * page, or start free); learners with nothing to count yet are asked to start learning, with the
 * way to today's lessons as the state's one action.
 */
export async function ProgressEmptyState({
  isAuthenticated,
  next,
}: {
  isAuthenticated: boolean;
  /** The stats page it stands in, to come back to after logging in. */
  next: string;
}) {
  const t = await getExtracted();
  const { icon: Icon } = getMenu("stats");

  if (!isAuthenticated) {
    return (
      <ProgressContent>
        <AuthGate className="py-4" next={next} />
      </ProgressContent>
    );
  }

  return (
    <ProgressContent>
      <Empty className="py-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("Start learning to track your progress")}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Link className={buttonVariants({ size: "sm" })} href={getMenu("today").url}>
            {t("Go to Today")}
          </Link>
        </EmptyContent>
      </Empty>
    </ProgressContent>
  );
}
