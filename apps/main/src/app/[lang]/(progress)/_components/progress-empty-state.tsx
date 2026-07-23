import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted } from "next-intl/server";
import { ProgressContent } from "./progress-content";

export async function ProgressEmptyState({
  isAuthenticated,
  children,
}: {
  isAuthenticated: boolean;
  children: React.ReactNode;
}) {
  const t = await getExtracted();

  return (
    <ProgressContent>
      <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-4">
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
      {children}
    </ProgressContent>
  );
}
