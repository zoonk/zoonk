import Link from "next/link";
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
import { getExtracted } from "next-intl/server";

export async function UpgradeCTA() {
  const t = await getExtracted();

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>

        <EmptyTitle>{t("Upgrade to generate")}</EmptyTitle>

        <EmptyDescription>
          {t("Generating content with AI requires an active subscription.")}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Link className={cn(buttonVariants(), "w-max")} href="/subscription">
          {t("Upgrade")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
