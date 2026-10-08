import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

/** A visitor's way in, in a top bar: an outline button as tall as the bar's other controls. */
export async function LoginBarLink({ className }: { className?: string }) {
  const t = await getExtracted();

  return (
    <Link
      className={cn(buttonVariants({ size: "bar", variant: "outline" }), className)}
      href="/login"
      prefetch={false}
    >
      {t("Log in")}
    </Link>
  );
}
