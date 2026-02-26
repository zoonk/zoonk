import Link from "next/link";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted } from "next-intl/server";

export async function PerformanceEmptyState({
  isAuthenticated,
  children,
}: {
  isAuthenticated: boolean;
  children: React.ReactNode;
}) {
  const t = await getExtracted();

  return (
    <div className="flex flex-col gap-8">
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
    </div>
  );
}
