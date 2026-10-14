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
 * Where a stat's numbers would be while there's nothing to count: the app's empty state, on the
 * column's edge, with its glyph, one line and, when there is one, the thing to do about it.
 */
export function ProgressEmpty({
  action,
  icon,
  title,
}: {
  action?: React.ReactNode;
  /** A quiet glyph for the stat. */
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <ProgressContent>
      <Empty className="py-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </ProgressContent>
  );
}

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
    <ProgressEmpty
      action={
        <Link className={buttonVariants({ size: "sm" })} href={getMenu("today").url}>
          {t("Go to Today")}
        </Link>
      }
      icon={<Icon aria-hidden="true" />}
      title={t("Start learning to track your progress")}
    />
  );
}
