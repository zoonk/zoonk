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
