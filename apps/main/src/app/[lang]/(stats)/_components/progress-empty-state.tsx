import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted } from "next-intl/server";
import { ProgressContent } from "./progress-content";

/** Visitors are asked to log in; learners with nothing to count yet, to start learning. */
export async function ProgressEmptyState({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = await getExtracted();

  return (
    <ProgressContent>
      <div className="text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-4 text-center">
        {isAuthenticated ? (
          t("Start learning to track your progress")
        ) : (
          <>
            <span>{t("Log in to track your progress")}</span>
            <Link className={buttonVariants()} href="/login" prefetch={false}>
              {t("Login")}
            </Link>
          </>
        )}
      </div>
    </ProgressContent>
  );
}
