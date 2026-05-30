import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { cn } from "@zoonk/ui/lib/utils";
import { SparklesIcon } from "lucide-react";
import { type Route } from "next";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

export async function UpgradeCTA<Href extends string>({
  backHref,
  backLabel,
  description,
  title,
}: {
  backHref: Route<Href>;
  backLabel: string;
  description?: string;
  title?: string;
}) {
  const t = await getExtracted();

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>

        <EmptyTitle>{title ?? t("Upgrade to create")}</EmptyTitle>

        <EmptyDescription>
          {description ?? t("Creating content with AI requires an active subscription.")}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-max")}
          href={backHref}
          prefetch
        >
          {backLabel}
        </Link>

        <Link className={cn(buttonVariants(), "w-max")} href="/subscription" prefetch>
          {t("Upgrade")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
